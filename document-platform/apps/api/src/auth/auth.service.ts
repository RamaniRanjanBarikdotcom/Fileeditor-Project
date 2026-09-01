import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { PlatformRole, UserStatus } from '@prisma/client';
import { TransactionalEmailService } from './transactional-email.service';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// ─── DTOs ────────────────────────────────────────────────────

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  organizationName?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    platformRole: PlatformRole;
    emailVerified: boolean;
    defaultOrganizationId?: string;
  };
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  platformRole: PlatformRole;
  orgId?: string; // active organization
}

// ─── Auth Service ────────────────────────────────────────────

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly email: TransactionalEmailService,
  ) {}

  /**
   * Register a new user, create their default organization, and initialize a refresh session.
   */
  async register(
    dto: RegisterDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          platformRole: PlatformRole.CUSTOMER,
        },
      });

      // Default organization
      const slug = `org-${newUser.id.slice(0, 8)}`;
      const org = await tx.organization.create({
        data: {
          name: dto.organizationName?.trim() || 'Personal Workspace',
          slug,
          ownerUserId: newUser.id,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: newUser.id,
          role: 'OWNER',
        },
      });

      return { ...newUser, orgId: org.id };
    });

    return this.createAuthSession(user, user.orgId, meta);
  }

  /**
   * Authenticate a user with email and password, creating a new refresh session.
   */
  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        memberships: {
          take: 1,
          select: { organizationId: true },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const orgId = user.memberships[0]?.organizationId;
    return this.createAuthSession(user, orgId, meta);
  }

  /**
   * Refresh session using a rotating refresh token.
   */
  async refresh(
    rawRefreshToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              take: 1,
              select: { organizationId: true },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active.');
    }

    // Revoke old session token
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const orgId = session.user.memberships[0]?.organizationId;
    return this.createAuthSession(session.user, orgId, meta);
  }

  /**
   * Logout user by revoking their current refresh session.
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Request password reset token.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean }> {
    this.email.assertConfigured();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      // Return success to avoid email enumeration
      return { success: true };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.email.sendPasswordReset(user.email, rawToken);
    return { success: true };
  }

  /**
   * Reset password with token, and revoke ALL active refresh sessions.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const tokenHash = this.hashToken(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all active sessions for security
      this.prisma.refreshSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  /**
   * Request email verification token.
   */
  async requestEmailVerification(userId: string): Promise<{ success: boolean }> {
    this.email.assertConfigured();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.emailVerifiedAt) {
      return { success: true };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.email.sendEmailVerification(user.email, rawToken);

    return { success: true };
  }

  /**
   * Confirm email verification.
   */
  async confirmEmailVerification(dto: VerifyEmailDto): Promise<{ success: boolean }> {
    const tokenHash = this.hashToken(dto.token);

    const tokenRecord = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  /**
   * Get current user profile.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        platformRole: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: {
                  select: {
                    id: true,
                    tier: true,
                    name: true,
                    monthlyOpsLimit: true,
                    hasApiAccess: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  /**
   * Validate a JWT payload (used by JwtStrategy).
   */
  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, status: true, platformRole: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      orgId: payload.orgId,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────

  private async createAuthSession(
    user: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      platformRole: PlatformRole;
      emailVerifiedAt?: Date | null;
    },
    orgId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
      orgId,
    };

    // Short-lived access token: 15 minutes
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // 64-byte random hex refresh token
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpiresInDays = 30;
    const expiresAt = new Date(Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000);

    // Save refresh session in DB
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        platformRole: user.platformRole,
        emailVerified: !!user.emailVerifiedAt,
        defaultOrganizationId: orgId,
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
