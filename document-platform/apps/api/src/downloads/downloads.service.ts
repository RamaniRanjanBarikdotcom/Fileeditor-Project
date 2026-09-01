import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StorageClient, createStorageConfig } from '@docconv/storage';

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);
  private readonly storage: StorageClient;

  constructor(private readonly prisma: PrismaService) {
    this.storage = new StorageClient(
      createStorageConfig(process.env as Record<string, string>),
    );
  }

  /**
   * Generates a signed, short-lived download URL for purchased software.
   */
  async getDownloadUrl(params: {
    userId: string;
    productId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // 1. Verify Entitlement
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        userId: params.userId,
        productId: params.productId,
        isActive: true,
      },
      include: {
        product: {
          include: {
            releases: {
              where: { isCurrent: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!entitlement) {
      throw new ForbiddenException(
        'You do not have an active purchase or entitlement for this product.',
      );
    }

    const release = entitlement.product.releases[0];
    if (!release) {
      throw new NotFoundException('No active software release found for this product.');
    }

    // 2. Generate Presigned URL (15 minutes TTL)
    const signedUrl = await this.storage.getSignedDownloadUrl(
      'outputs',
      release.storageKey,
      900,
      `${entitlement.product.slug}-${release.version}.zip`,
    );

    // 3. Log download event
    await this.prisma.downloadLog.create({
      data: {
        userId: params.userId,
        releaseId: release.id,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    this.logger.log(`Generated download URL for user '${params.userId}' product '${entitlement.product.name}' v${release.version}`);

    return {
      downloadUrl: signedUrl,
      fileName: `${entitlement.product.slug}-${release.version}.zip`,
      version: release.version,
      fileSizeBytes: Number(release.fileSizeBytes),
      checksumSha256: release.fileSha256,
      expiresInSeconds: 900,
    };
  }

  /**
   * Get all products, releases, and licenses in user's library.
   */
  async getUserLibrary(userId: string) {
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        product: {
          include: {
            releases: {
              where: { isCurrent: true },
              take: 1,
            },
            licenses: {
              where: { userId },
              include: {
                activations: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return entitlements.map((ent) => {
      const release = ent.product.releases[0];
      const license = ent.product.licenses[0];

      return {
        entitlementId: ent.id,
        productId: ent.productId,
        productName: ent.product.name,
        productSlug: ent.product.slug,
        productType: ent.product.type,
        grantedAt: ent.createdAt,
        release: release
          ? {
              version: release.version,
              fileSizeBytes: Number(release.fileSizeBytes),
              releaseNotes: release.changelog,
              releasedAt: release.createdAt,
            }
          : null,
        license: license
          ? {
              id: license.id,
              keyMasked: license.keyMasked,
              status: license.status,
              activationsUsed: license.activations.length,
              maxActivations: license.maxActivations,
            }
          : null,
      };
    });
  }
}
