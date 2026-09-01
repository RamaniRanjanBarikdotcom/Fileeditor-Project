import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { LicenseStatus } from '@prisma/client';

@Injectable()
export class LicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generates a cryptographic license key formatted as TOOL-XXXX-XXXX-XXXX-XXXX.
   */
  generateKeyString(): string {
    const raw = crypto.randomBytes(16).toString('hex').toUpperCase();
    return `TOOL-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  }

  /**
   * Hashes a key for secure database storage.
   */
  hashKey(key: string): string {
    return crypto.createHash('sha256').update(key.trim()).digest('hex');
  }

  /**
   * Masks a key for safe display in dashboard/receipts.
   */
  maskKey(key: string): string {
    const parts = key.trim().split('-');
    if (parts.length === 5) {
      return `${parts[0]}-****-****-${parts[4]}`;
    }
    return `TOOL-****-${key.slice(-4)}`;
  }

  /**
   * Issue a new license key upon successful checkout.
   */
  async issueLicenseKey(params: {
    userId: string;
    productId: string;
    orderId?: string;
    maxActivations?: number;
    expiresAt?: Date;
  }) {
    const key = this.generateKeyString();
    const keyHash = this.hashKey(key);
    const keyMasked = this.maskKey(key);

    const record = await this.prisma.licenseKey.create({
      data: {
        userId: params.userId,
        productId: params.productId,
        orderId: params.orderId,
        keyHash,
        keyMasked,
        status: LicenseStatus.ACTIVE,
        maxActivations: params.maxActivations ?? 3,
        expiresAt: params.expiresAt,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      license: record,
      plainKey: key,
    };
  }

  /**
   * Activate a license key on a client machine.
   */
  async activateLicense(params: {
    key: string;
    machineHash: string;
    deviceInfo?: string;
    ipAddress?: string;
  }) {
    const keyHash = this.hashKey(params.key);

    const license = await this.prisma.licenseKey.findUnique({
      where: { keyHash },
      include: {
        product: true,
        activations: true,
      },
    });

    if (!license) {
      throw new NotFoundException('Invalid license key.');
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      throw new ForbiddenException(`License is ${license.status.toLowerCase()}.`);
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      throw new ForbiddenException('License key has expired.');
    }

    // Check if machine is already activated
    const existingActivation = license.activations.find(
      (act: any) => act.machineHash === params.machineHash,
    );

    if (existingActivation) {
      // Update ping
      await this.prisma.licenseActivation.update({
        where: { id: existingActivation.id },
        data: {
          lastPingAt: new Date(),
          ipAddress: params.ipAddress,
          deviceInfo: params.deviceInfo || existingActivation.deviceInfo,
        },
      });

      const token = this.jwtService.sign(
        {
          licenseId: license.id,
          activationId: existingActivation.id,
          machineHash: params.machineHash,
          productId: license.productId,
          productSlug: license.product.slug,
          productName: license.product.name,
        },
        { expiresIn: '30d' },
      );

      return {
        success: true,
        activated: true,
        activationToken: token,
        license: {
          id: license.id,
          keyMasked: license.keyMasked,
          productName: license.product.name,
          activationsUsed: license.activations.length,
          maxActivations: license.maxActivations,
        },
      };
    }

    // Check max activations limit
    if (license.activations.length >= license.maxActivations) {
      throw new BadRequestException(
        `Activation limit reached (${license.activations.length}/${license.maxActivations} seats used). Please deactivate an existing machine first.`,
      );
    }

    // Create new activation
    const activation = await this.prisma.licenseActivation.create({
      data: {
        licenseKeyId: license.id,
        machineHash: params.machineHash,
        deviceInfo: params.deviceInfo || 'Unknown Device',
        ipAddress: params.ipAddress,
      },
    });

    await this.prisma.licenseKey.update({
      where: { id: license.id },
      data: { activationsCount: license.activations.length + 1 },
    });

    const token = this.jwtService.sign(
      {
        licenseId: license.id,
        activationId: activation.id,
        machineHash: params.machineHash,
        productId: license.productId,
        productSlug: license.product.slug,
        productName: license.product.name,
      },
      { expiresIn: '30d' },
    );

    return {
      success: true,
      activated: true,
      activationToken: token,
      license: {
        id: license.id,
        keyMasked: license.keyMasked,
        productName: license.product.name,
        activationsUsed: license.activations.length + 1,
        maxActivations: license.maxActivations,
      },
    };
  }

  /**
   * Get licenses belonging to an authenticated user.
   */
  async getUserLicenses(userId: string) {
    return this.prisma.licenseKey.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, slug: true, type: true } },
        activations: {
          select: {
            id: true,
            deviceInfo: true,
            createdAt: true,
            lastPingAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
