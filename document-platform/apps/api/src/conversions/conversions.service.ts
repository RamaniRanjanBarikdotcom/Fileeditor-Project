import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { conversionRouter } from '@docconv/conversion-router';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import {
  InputFormat,
  OutputFormat,
  CreateConversionRequest,
  JobStatus,
  ConversionJobData,
  QUEUE_NAMES,
  normalizeConversionOptions,
} from '@docconv/shared-types';

@Injectable()
export class ConversionsService {
  private storageClient: StorageClient;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.HTML) private readonly htmlQueue: Queue,
    @InjectQueue(QUEUE_NAMES.OFFICE) private readonly officeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MARKDOWN) private readonly markdownQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DATA) private readonly dataQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DOCUMENT) private readonly documentQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IMAGE) private readonly imageQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF) private readonly pdfQueue: Queue,
  ) {
    this.storageClient = new StorageClient(
      createStorageConfig(process.env as Record<string, string | undefined>),
    );
  }

  private getQueueForEngine(engine: string): Queue {
    const queueName = conversionRouter.getQueueName(engine as any);
    switch (queueName) {
      case QUEUE_NAMES.HTML:
        return this.htmlQueue;
      case QUEUE_NAMES.OFFICE:
        return this.officeQueue;
      case QUEUE_NAMES.MARKDOWN:
        return this.markdownQueue;
      case QUEUE_NAMES.DATA:
        return this.dataQueue;
      case QUEUE_NAMES.DOCUMENT:
        return this.documentQueue;
      case QUEUE_NAMES.IMAGE:
        return this.imageQueue;
      case QUEUE_NAMES.PDF:
        return this.pdfQueue;
      default:
        return this.htmlQueue;
    }
  }

  async createConversion(userId: string, orgId: string, req: CreateConversionRequest) {
    if (process.env.REDIS_ENABLED === 'false') {
      throw new ServiceUnavailableException(
        'Server conversion workers are disabled in this deployment. Use a browser-capable tool or enable Redis and the worker service.',
      );
    }

    const sourceFile = await this.prisma.storedFile.findFirst({
      where: { id: req.sourceFileId, organizationId: orgId, userId, deletedAt: null },
    });

    if (!sourceFile) throw new NotFoundException('Source file not found.');
    if (sourceFile.status !== 'READY')
      throw new BadRequestException('File is not ready for conversion.');

    const normalizedInput = conversionRouter.normalizeFormat(sourceFile.extension);
    if (!Object.values(InputFormat).includes(normalizedInput as InputFormat)) {
      throw new BadRequestException(`Unsupported source format: ${sourceFile.extension}`);
    }
    const inputFormat = normalizedInput as InputFormat;
    const normalizedTarget = conversionRouter.normalizeFormat(req.targetFormat);
    if (!Object.values(OutputFormat).includes(normalizedTarget as OutputFormat)) {
      throw new BadRequestException(`Unsupported target format: ${req.targetFormat}`);
    }
    const targetFormat = normalizedTarget as OutputFormat;
    const adapter = conversionRouter.findAdapter(inputFormat, targetFormat);

    if (!adapter) {
      throw new BadRequestException(
        `Conversion from ${inputFormat} to ${targetFormat} is not supported.`,
      );
    }

    const settings = normalizeConversionOptions(req.settings);
    const retentionSeconds = Math.min(
      600,
      Math.max(60, Number(process.env.TEMP_FILE_MAX_TTL_SECONDS || 600)),
    );
    const job = await this.prisma.conversionJob.create({
      data: {
        organizationId: orgId,
        userId,
        sourceFileId: sourceFile.id,
        sourceFormat: inputFormat,
        targetFormat,
        engine: adapter.engine,
        settingsJson: settings as any,
        status: JobStatus.QUEUED,
        queuedAt: new Date(),
        expiresAt: new Date(Date.now() + retentionSeconds * 1000),
      },
    });

    const queue = this.getQueueForEngine(adapter.engine);
    const jobData: ConversionJobData = {
      conversionId: job.id,
      sourceFileId: sourceFile.id,
      sourceStorageKey: sourceFile.storageKey,
      sourceFormat: inputFormat,
      targetFormat,
      engine: adapter.engine,
      options: settings,
      attemptNumber: 1,
    };

    await queue.add('convert', jobData, {
      jobId: job.id,
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return { id: job.id, status: job.status, engine: job.engine };
  }

  async getJobStatus(jobId: string, orgId: string) {
    const job = await this.prisma.conversionJob.findFirst({
      where: { id: jobId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        progress: true,
        errorCode: true,
        errorMessage: true,
        outputFileId: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getDownloadUrl(jobId: string, orgId: string): Promise<string> {
    const job = await this.prisma.conversionJob.findFirst({
      where: { id: jobId, organizationId: orgId },
      include: { outputFile: true },
    });

    if (!job || !job.outputFile) {
      throw new NotFoundException('Job output not found or incomplete');
    }

    return this.storageClient.getSignedDownloadUrl('outputs', job.outputFile.storageKey, 600);
  }

  async cancelConversion(jobId: string, orgId: string, userId?: string) {
    const job = await this.prisma.conversionJob.findFirst({
      where: { id: jobId, organizationId: orgId, ...(userId ? { userId } : {}) },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (
      job.status === JobStatus.COMPLETED ||
      job.status === JobStatus.FAILED ||
      job.status === JobStatus.EXPIRED
    ) {
      throw new BadRequestException(`A ${job.status.toLowerCase()} job cannot be cancelled.`);
    }
    if (job.status === JobStatus.CANCELLED) return { id: job.id, status: job.status };

    const queue = this.getQueueForEngine(job.engine || '');
    const queuedJob = await queue.getJob(job.id);
    if (queuedJob) await queuedJob.remove().catch(() => undefined);

    const cancelled = await this.prisma.conversionJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
        errorCode: 'CANCELLED',
        errorMessage: 'The conversion was cancelled.',
      },
    });
    return { id: cancelled.id, status: cancelled.status };
  }

  async listConversions(userId: string, orgId: string, page = 1, pageSize = 20) {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.conversionJob.findMany({
        where: { organizationId: orgId, userId },
        include: {
          sourceFile: { select: { originalFilename: true, sizeBytes: true } },
          outputFile: { select: { originalFilename: true, sizeBytes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.conversionJob.count({
        where: { organizationId: orgId, userId },
      }),
    ]);

    return {
      items: items.map((job) => ({
        id: job.id,
        filename: job.sourceFile?.originalFilename || 'document',
        sourceFormat: job.sourceFormat,
        targetFormat: job.targetFormat,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
        fileSize: job.sourceFile ? Number(job.sourceFile.sizeBytes) : 0,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
