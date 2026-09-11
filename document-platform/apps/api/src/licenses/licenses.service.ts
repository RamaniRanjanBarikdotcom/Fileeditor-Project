import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { LicenseStatus, Prisma } from '@prisma/client';

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

  private getEncryptionKey(): Buffer {
    const configured = process.env.LICENSE_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!configured && process.env.NODE_ENV === 'production') {
      throw new Error('LICENSE_ENCRYPTION_KEY must be configured in production.');
    }
    return crypto
      .createHash('sha256')
      .update(configured || 'apptoolkitlab-local-license-key')
      .digest();
  }

  private encryptKey(key: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
  }

  decryptKey(ciphertext: string): string {
    const [ivPart, tagPart, dataPart] = ciphertext.split('.');
    if (!ivPart || !tagPart || !dataPart) throw new Error('Invalid encrypted license payload.');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
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
  }, transaction?: Prisma.TransactionClient) {
    const key = this.generateKeyString();
    const keyHash = this.hashKey(key);
    const keyMasked = this.maskKey(key);

    const db = transaction || this.prisma;
    const record = await db.licenseKey.create({
      data: {
        userId: params.userId,
        productId: params.productId,
        orderId: params.orderId,
        keyHash,
        keyMasked,
        keyCiphertext: this.encryptKey(key),
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

    const performActivation = () =>
      this.prisma.$transaction(
        async (tx) => {
          const license = await tx.licenseKey.findUnique({
            where: { keyHash },
            include: { product: true },
          });

          if (!license) throw new NotFoundException('Invalid license key.');
          if (license.status !== LicenseStatus.ACTIVE) {
            throw new ForbiddenException(`License is ${license.status.toLowerCase()}.`);
          }
          if (license.expiresAt && license.expiresAt < new Date()) {
            throw new ForbiddenException('License key has expired.');
          }

          const existing = await tx.licenseActivation.findUnique({
            where: {
              licenseKeyId_machineHash: {
                licenseKeyId: license.id,
                machineHash: params.machineHash,
              },
            },
          });

          if (existing) {
            const activation = await tx.licenseActivation.update({
              where: { id: existing.id },
              data: {
                lastPingAt: new Date(),
                ipAddress: params.ipAddress,
                deviceInfo: params.deviceInfo || existing.deviceInfo,
              },
            });
            return { license, activation, activationsUsed: license.activationsCount };
          }

          const slot = await tx.licenseKey.updateMany({
            where: {
              id: license.id,
              status: LicenseStatus.ACTIVE,
              activationsCount: { lt: license.maxActivations },
            },
            data: { activationsCount: { increment: 1 } },
          });
          if (slot.count !== 1) {
            throw new BadRequestException(
              `Activation limit reached (${license.activationsCount}/${license.maxActivations} seats used). Please deactivate an existing machine first.`,
            );
          }

          const activation = await tx.licenseActivation.create({
            data: {
              licenseKeyId: license.id,
              machineHash: params.machineHash,
              deviceInfo: params.deviceInfo || 'Unknown Device',
              ipAddress: params.ipAddress,
            },
          });
          return { license, activation, activationsUsed: license.activationsCount + 1 };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    let result: Awaited<ReturnType<typeof performActivation>> | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await performActivation();
        break;
      } catch (error: any) {
        if (error?.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    if (!result) throw new Error('License activation could not be completed.');

    const { license, activation, activationsUsed } = result;

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
        activationsUsed,
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
      select: {
        id: true,
        keyMasked: true,
        status: true,
        maxActivations: true,
        activationsCount: true,
        expiresAt: true,
        createdAt: true,
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
