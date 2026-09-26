import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    // Safe idempotent methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Webhooks have dedicated raw body signature verification
    if (req.originalUrl?.startsWith('/api/v1/webhooks') || req.path?.startsWith('/webhooks')) {
      return true;
    }

    // License activation authenticates with the license key payload
    if (req.originalUrl?.startsWith('/api/v1/licenses/activate')) {
      return true;
    }

    // Bearer-authenticated API clients do not rely on ambient cookies.
    // However, we MUST cryptographically verify the JWT to prevent bypass via forged or unverified Bearer headers.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const secret = this.config.get<string>('JWT_SECRET', 'dev-secret-change-me');
          await this.jwtService.verifyAsync(token, { secret });
          return true; // Verified Bearer token
        } catch {
          // Token is invalid, expired, or forged - fall through to strict origin/referer verification
        }
      }
    }

    const allowedOriginsConfig = this.config.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000,http://localhost:5173,http://localhost:4000',
    );
    const allowedOrigins = new Set(
      allowedOriginsConfig
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try { return new URL(value).origin; } catch { return ''; }
        })
        .filter(Boolean),
    );

    const getOrigin = (value: string): string | null => {
      try { return new URL(value).origin; } catch { return null; }
    };

    const origin = req.headers['origin'] as string | undefined;
    const referer = req.headers['referer'] as string | undefined;

    if (origin) {
      const isAllowedOrigin = allowedOrigins.has(getOrigin(origin) || '');
      if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(`Untrusted origin: ${origin}`);
      }
      return true;
    }

    if (referer) {
      const isAllowedReferer = allowedOrigins.has(getOrigin(referer) || '');
      if (!isAllowedReferer && process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(`Untrusted referer: ${referer}`);
      }
      return true;
    }

    // In production, block cookie-authenticated mutations without Origin/Referer.
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'CSRF/Origin validation failed: Missing origin or validation headers.',
      );
    }

    return true;
  }
}
