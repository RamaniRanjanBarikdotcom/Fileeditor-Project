import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStatus, JobStatus } from '@prisma/client';
import { apiLogger } from '@docconv/logging';
import { StorageClient, BucketType, createStorageConfig } from '@docconv/storage';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TempFileCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly storage = new StorageClient(
    createStorageConfig(process.env as Record<string, string | undefined>),
  );
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = Math.max(
      10_000,
      this.config.get<number>('TEMP_FILE_CLEANUP_INTERVAL_MS', 60_000),
    );
    this.timer = setInterval(() => void this.cleanupExpired(), intervalMs);
    this.timer.unref();
    void this.cleanupExpired();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanupExpired(now = new Date()): Promise<{ files: number; jobs: number }> {
    const files = await this.prisma.storedFile.findMany({
      where: {
        expiresAt: { lte: now },
        status: { notIn: [FileStatus.DELETED, FileStatus.EXPIRED] },
      },
      select: { id: true, storageKey: true },
      take: 200,
    });

    let deletedFiles = 0;
    for (const file of files) {
      try {
        await this.storage.delete(this.bucketForKey(file.storageKey), file.storageKey);
        await this.prisma.storedFile.update({
          where: { id: file.id },
          data: { status: FileStatus.EXPIRED, deletedAt: now },
        });
        deletedFiles += 1;
      } catch (error) {
        apiLogger.warn({ fileId: file.id, err: error }, 'Temporary file cleanup failed; will retry');
      }
    }

    const expiredJobs = await this.prisma.conversionJob.updateMany({
      where: {
        expiresAt: { lte: now },
        status: { notIn: [JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.EXPIRED] },
      },
      data: {
        status: JobStatus.EXPIRED,
        completedAt: now,
        errorCode: 'EXPIRED',
        errorMessage: 'The conversion and its temporary files have expired.',
      },
    });
    if (deletedFiles || expiredJobs.count) {
      apiLogger.info({ deletedFiles, expiredJobs: expiredJobs.count }, 'Temporary data cleanup completed');
    }
    return { files: deletedFiles, jobs: expiredJobs.count };
  }

  private bucketForKey(key: string): BucketType {
    if (key.includes('/outputs/')) return 'outputs';
    if (key.includes('/quarantine/')) return 'quarantine';
    if (key.includes('/previews/')) return 'previews';
    return 'inputs';
  }
}
