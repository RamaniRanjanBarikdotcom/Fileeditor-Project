import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  ForbiddenException,
  OnModuleInit,
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
import {
  PlatformRole,
  ReservationStatus,
  SubscriptionPlanTier,
  SubscriptionStatus,
} from '@prisma/client';
import { ConversionOutboxService } from './conversion-outbox.service';
import { RedisService } from '../common/redis.service';

@Injectable()
export class ConversionsService implements OnModuleInit {
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
    private readonly outbox: ConversionOutboxService,
    private readonly redis: RedisService,
  ) {
    this.storageClient = new StorageClient(
      createStorageConfig(process.env as Record<string, string | undefined>),
    );
  }

  async onModuleInit() {
    await this.storageClient.ensureAllBuckets();
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

    // ─── Transactional Job Creation, Quota Reservation & Outbox Event ───
    const { job, outboxEvent } = await this.prisma.$transaction(async (tx) => {
      let tool = await tx.tool.findFirst({
        where: {
          isPublished: true,
          acceptedFormats: { has: inputFormat },
          outputFormats: { has: targetFormat },
        },
        orderBy: { costUnits: 'desc' },
      });
      if (!tool) {
        tool = await tx.tool.upsert({
          where: { slug: 'document-conversion' },
          update: {},
          create: {
            slug: 'document-conversion',
            name: 'Document Conversion',
            category: 'CONVERSION',
            engine: adapter.engine,
            acceptedFormats: [inputFormat],
            outputFormats: [targetFormat],
            anonymousEnabled: true,
            costUnits: 1,
          },
        });
      }

      const organization = await tx.organization.findUnique({
        where: { id: orgId },
        include: {
          plan: true,
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { gt: new Date() } },
            include: { plan: true },
            orderBy: { currentPeriodEnd: 'desc' },
            take: 1,
          },
        },
      });
      if (!organization) throw new NotFoundException('Organization not found.');
      const account = await tx.user.findFirst({
        where: { id: userId, memberships: { some: { organizationId: orgId } } },
        select: { platformRole: true },
      });
      if (!account) throw new ForbiddenException('The requested workspace is not available.');
      const isAdmin = account.platformRole === PlatformRole.ADMIN;
      const plan =
        organization.subscriptions[0]?.plan ||
        organization.plan ||
        (await tx.subscriptionPlan.findUnique({ where: { tier: SubscriptionPlanTier.FREE } }));
      if (!plan) {
        throw new ServiceUnavailableException('Subscription plans are not initialized.');
      }
      if (sourceFile.sizeBytes > tool.maxFileSizeBytes) {
        throw new ForbiddenException('This file exceeds the technical limit for this tool.');
      }
      if (!isAdmin && sourceFile.sizeBytes > plan.maxFileSizeBytes) {
        throw new ForbiddenException('This file exceeds the active subscription plan limit.');
      }

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      await tx.quotaReservation.updateMany({
        where: {
          organizationId: orgId,
          status: ReservationStatus.RESERVED,
          expiresAt: { lt: now },
        },
        data: { status: ReservationStatus.EXPIRED, settledAt: now },
      });
      const [usage, reserved] = await Promise.all([
        tx.usageRecord.aggregate({
          where: { organizationId: orgId, createdAt: { gte: monthStart } },
          _sum: { units: true },
        }),
        tx.quotaReservation.aggregate({
          where: { organizationId: orgId, status: ReservationStatus.RESERVED },
          _sum: { unitsReserved: true },
        }),
      ]);
      const costUnits = Math.max(1, tool.costUnits);
      const committedUnits = (usage._sum.units || 0) + (reserved._sum.unitsReserved || 0);
      if (!isAdmin && committedUnits + costUnits > plan.monthlyOpsLimit) {
        throw new ForbiddenException(
          `Monthly conversion quota reached (${plan.monthlyOpsLimit} units).`,
        );
      }

      const newJob = await tx.conversionJob.create({
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

      const newReservation = await tx.quotaReservation.create({
        data: {
          idempotencyKey: `job-${newJob.id}`,
          userId,
          organizationId: orgId,
          toolId: tool.id,
          conversionJobId: newJob.id,
          unitsReserved: costUnits,
          status: ReservationStatus.RESERVED,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      await tx.conversionEvent.create({
        data: {
          conversionJobId: newJob.id,
          eventType: 'CONVERSION_REQUESTED',
          message: `Conversion from ${inputFormat} to ${targetFormat} queued with engine ${adapter.engine}`,
          metadataJson: {
            sourceFormat: inputFormat,
            targetFormat,
            engine: adapter.engine,
            reservationId: newReservation.id,
          },
        },
      });

      const queueName = conversionRouter.getQueueName(adapter.engine as any);
      const jobData: ConversionJobData = {
        conversionId: newJob.id,
        sourceFileId: sourceFile.id,
        sourceStorageKey: sourceFile.storageKey,
        sourceFormat: inputFormat,
        targetFormat,
        engine: adapter.engine,
        options: settings,
        attemptNumber: 1,
      };
      const newOutboxEvent = await tx.outboxEvent.create({
        data: {
          aggregateType: 'ConversionJob',
          aggregateId: newJob.id,
          eventType: 'CONVERSION_REQUESTED',
          payloadJson: { queueName, jobData } as any,
        },
      });

      return { job: newJob, outboxEvent: newOutboxEvent };
    });

    // Best-effort immediate publish. Failure remains durable and the dispatcher
    // retries it; the accepted job must not be falsely marked as failed.
    await this.outbox.publish(outboxEvent.id);

    return { id: job.id, status: job.status, engine: job.engine };
  }

  async getQuotaStatus(userId: string, orgId: string) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [account, organization, usage, reserved] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, memberships: { some: { organizationId: orgId } } },
        select: { platformRole: true },
      }),
      this.prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          plan: true,
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { gt: now } },
            include: { plan: true },
            orderBy: { currentPeriodEnd: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.usageRecord.aggregate({
        where: { organizationId: orgId, createdAt: { gte: monthStart } },
        _sum: { units: true },
      }),
      this.prisma.quotaReservation.aggregate({
        where: {
          organizationId: orgId,
          status: ReservationStatus.RESERVED,
          expiresAt: { gt: now },
        },
        _sum: { unitsReserved: true },
      }),
    ]);
    if (!account || !organization) {
      throw new ForbiddenException('The requested workspace is not available.');
    }
    const fallback = await this.prisma.subscriptionPlan.findUnique({
      where: { tier: SubscriptionPlanTier.FREE },
    });
    const plan = organization.subscriptions[0]?.plan || organization.plan || fallback;
    if (!plan) throw new ServiceUnavailableException('Subscription plans are not initialized.');
    const used = usage._sum.units || 0;
    const reservedUnits = reserved._sum.unitsReserved || 0;
    const unlimited = account.platformRole === PlatformRole.ADMIN;
    return {
      accessLevel: unlimited ? 'ADMIN' : 'SUBSCRIPTION',
      tier: unlimited ? 'ADMIN' : plan.tier,
      unlimited,
      used,
      reserved: reservedUnits,
      limit: unlimited ? null : plan.monthlyOpsLimit,
      remaining: unlimited ? null : Math.max(0, plan.monthlyOpsLimit - used - reservedUnits),
    };
  }

  async getJobStatus(jobId: string, orgId: string, userId?: string) {
    const job = await this.prisma.conversionJob.findFirst({
      where: { id: jobId, organizationId: orgId, ...(userId ? { userId } : {}) },
      select: {
        id: true,
        status: true,
        progress: true,
        errorCode: true,
        errorMessage: true,
        outputFileId: true,
        outputFile: { select: { originalFilename: true } },
        startedAt: true,
        completedAt: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');
    return {
      ...job,
      outputFilename: job.outputFile?.originalFilename || null,
      outputFile: undefined,
    };
  }

  async getDownloadUrl(jobId: string, orgId: string, userId?: string): Promise<string> {
    const job = await this.prisma.conversionJob.findFirst({
      where: { id: jobId, organizationId: orgId, ...(userId ? { userId } : {}) },
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
    await this.redis.set(`conversion:cancel:${job.id}`, '1', 600);
    const queuedJob = await queue.getJob(job.id);
    if (queuedJob) await queuedJob.remove().catch(() => undefined);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updatedJob = await tx.conversionJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.CANCELLED,
          completedAt: new Date(),
          errorCode: 'CANCELLED',
          errorMessage: 'The conversion was cancelled.',
        },
      });

      await tx.quotaReservation.updateMany({
        where: { conversionJobId: job.id, status: ReservationStatus.RESERVED },
        data: { status: ReservationStatus.RELEASED, settledAt: new Date() },
      });

      await tx.conversionEvent.create({
        data: {
          conversionJobId: job.id,
          eventType: 'CONVERSION_CANCELLED',
          message: 'Job cancelled by user; quota reservation released.',
        },
      });

      return updatedJob;
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
