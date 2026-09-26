import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  BlogGenerationStatus,
  BlogDocumentStatus,
  Prisma,
} from '@prisma/client';
import { Job } from 'bullmq';
import {
  BlogEngine,
  BlogGenerationCancelledError,
  sanitizeGeneratedHtml,
  type BlogCheckpoint,
  type BlogGenerationInput,
} from '@docconv/blog-engine';
import { PrismaService } from '../common/prisma.service';
import { BlogAiAdapter } from './blog-ai.adapter';
import { BlogUsageService } from './blog-usage.service';
import { BlogSchedulerService } from './blog-scheduler.service';
import { BlogPublishingService } from './blog-publishing.service';
import { BlogNotificationsService } from './blog-notifications.service';
import { BLOG_STUDIO_QUEUE } from './blog-studio.constants';
import { BlogResearchService } from './blog-research.service';

export { BLOG_STUDIO_QUEUE } from './blog-studio.constants';

@Injectable()
@Processor(BLOG_STUDIO_QUEUE, { concurrency: 2 })
export class BlogStudioProcessor extends WorkerHost {
  private readonly logger = new Logger(BlogStudioProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: BlogAiAdapter,
    private readonly usage: BlogUsageService,
    private readonly scheduler: BlogSchedulerService,
    private readonly publishing: BlogPublishingService,
    private readonly notifications: BlogNotificationsService,
    private readonly research: BlogResearchService,
  ) {
    super();
  }

  async process(queueJob: Job<{ jobId?: string; scheduleId?: string; organizationId?: string }>) {
    if (queueJob.name === 'process_schedule') {
      if (!queueJob.data.scheduleId || !queueJob.data.organizationId) return;
      return this.scheduler.processSchedule(queueJob.data.scheduleId, queueJob.data.organizationId);
    }
    if (!queueJob.data.jobId) return;
    const record = await this.prisma.blogGenerationJob.findUnique({
      where: { id: queueJob.data.jobId },
    });
    if (!record || record.status !== BlogGenerationStatus.QUEUED) return;
    if (record.cancelRequestedAt) {
      await this.cancel(record.id);
      return;
    }
    await this.prisma.blogGenerationJob.update({
      where: { id: record.id },
      data: { status: BlogGenerationStatus.PROCESSING, startedAt: new Date(), progress: 1 },
    });

    const abortController = new AbortController();
    const cancellationPoll = setInterval(() => {
      void this.prisma.blogGenerationJob
        .findUnique({ where: { id: record.id }, select: { cancelRequestedAt: true } })
        .then((current) => {
          if (current?.cancelRequestedAt) abortController.abort(new BlogGenerationCancelledError());
        })
        .catch((error) =>
          this.logger.warn({
            event: 'blog_cancellation_poll_failed',
            jobId: record.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }, 750);
    cancellationPoll.unref();

    try {
      const generationInput = record.inputJson as unknown as BlogGenerationInput;
      const generationAi = await this.ai.forGeneration(
        record.organizationId,
        generationInput.providerCredentialId,
        generationInput.promptTemplateVersion,
      );
      const engine = new BlogEngine({
        ai: generationAi,
        research: {
          search: (query, signal) => this.research.search(record.organizationId, query, signal),
        },
        abortSignal: abortController.signal,
        checkpoint: {
          load: async () => record.checkpointJson as unknown as BlogCheckpoint | null,
          save: async (checkpoint) => {
            await this.prisma.blogGenerationJob.update({
              where: { id: record.id },
              data: { checkpointJson: checkpoint as unknown as Prisma.InputJsonValue },
            });
          },
        },
        progress: async (event) => {
          await queueJob.updateProgress(event.progress);
          await this.prisma.blogGenerationJob.update({
            where: { id: record.id },
            data: { progress: event.progress, currentStage: event.stage },
          });
        },
        isCancelled: async () =>
          Boolean(
            (
              await this.prisma.blogGenerationJob.findUnique({
                where: { id: record.id },
                select: { cancelRequestedAt: true },
              })
            )?.cancelRequestedAt,
          ),
        logger: {
          info: (event, metadata) => this.logger.log({ event, jobId: record.id, ...metadata }),
          warn: (event, metadata) => this.logger.warn({ event, jobId: record.id, ...metadata }),
        },
      });
      const result = await engine.generate(generationInput);
      const safeHtml = sanitizeGeneratedHtml(result.html);
      const blog = await this.prisma.$transaction(async (tx) => {
        const slug = await uniqueSlug(tx, record.organizationId, result.metadata.slug);
        const document = await tx.blogDocument.create({
          data: {
            organizationId: record.organizationId,
            createdByUserId: record.userId,
            title: result.title,
            slug,
            topic: (record.inputJson as any).topic,
            html: safeHtml,
            editorJson: result.editorJson as Prisma.InputJsonValue,
            metadataJson: {
              ...result.metadata,
              model: result.model,
              writingStyle: (record.inputJson as any).writingStyle,
              tone: (record.inputJson as any).tone,
              focusKeyword: (record.inputJson as any).focusKeyword,
            },
            keywords: result.keywords,
            seoScore: result.seoScore,
            language: (record.inputJson as any).language,
            wordCount: result.wordCount,
            status: BlogDocumentStatus.READY,
            sources: {
              create: result.sources.map((source) => ({
                organizationId: record.organizationId,
                url: source.url,
                title: source.title,
                citationJson: { excerpt: source.excerpt || null },
                retrievedAt: new Date(source.retrievedAt),
              })),
            },
          },
        });
        await tx.blogGenerationJob.update({
          where: { id: record.id },
          data: {
            blogId: document.id,
            status: BlogGenerationStatus.COMPLETED,
            progress: 100,
            currentStage: 'finalize',
            model: result.model,
            completedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: record.organizationId,
            userId: record.userId,
            action: 'BLOG_GENERATION_COMPLETED',
            resourceType: 'BlogDocument',
            resourceId: document.id,
            metadataJson: { jobId: record.id },
          },
        });
        await this.usage.settle(record.id, result.usage, result.model, tx);
        return document;
      });
      await this.completeScheduledGeneration(record, blog.id).catch((error) =>
        this.logger.error({
          event: 'blog_schedule_completion_failed',
          jobId: record.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      await this.notifications
        .notifyJobComplete(record.organizationId, record.userId, blog.id)
        .catch(() => undefined);
      return { blogId: blog.id };
    } catch (error) {
      const cancellationRequested =
        abortController.signal.aborted ||
        Boolean(
          (
            await this.prisma.blogGenerationJob.findUnique({
              where: { id: record.id },
              select: { cancelRequestedAt: true },
            })
          )?.cancelRequestedAt,
        );
      if (error instanceof BlogGenerationCancelledError || cancellationRequested) {
        await this.cancel(record.id);
        return;
      }
      await this.prisma.blogGenerationJob.update({
        where: { id: record.id },
        data: {
          status: BlogGenerationStatus.FAILED,
          errorCode: 'GENERATION_FAILED',
          errorMessage:
            error instanceof Error ? error.message.slice(0, 1_000) : 'Generation failed.',
          completedAt: new Date(),
        },
      });
      await this.usage.release(record.id);
      await this.failScheduledGeneration(record, error).catch(() => undefined);
      await this.notifications
        .notifyJobFailed(
          record.organizationId,
          record.userId,
          error instanceof Error ? error.message : 'Generation failed.',
        )
        .catch(() => undefined);
      throw error;
    } finally {
      clearInterval(cancellationPoll);
    }
  }

  private async cancel(jobId: string) {
    await this.prisma.blogGenerationJob.update({
      where: { id: jobId },
      data: {
        status: BlogGenerationStatus.CANCELLED,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    await this.usage.release(jobId);
  }

  private async completeScheduledGeneration(
    record: { organizationId: string; userId: string; inputJson: Prisma.JsonValue },
    blogId: string,
  ) {
    const schedule = (record.inputJson as any)?.__schedule;
    if (!schedule?.scheduleId || !schedule?.runId) return;
    let publicationId: string | undefined;
    if (schedule.publish && schedule.destinationId) {
      const publication = await this.publishing.publish(
        record.organizationId,
        record.userId,
        blogId,
        schedule.destinationId,
        schedule.publishedAs === 'live' ? 'live' : 'draft',
      );
      publicationId = publication.id;
    }
    await this.prisma.$transaction([
      this.prisma.blogSchedule.update({
        where: { id: schedule.scheduleId },
        data: { status: 'COMPLETED', blogId },
      }),
      this.prisma.blogScheduleRun.update({
        where: { id: schedule.runId },
        data: {
          completedAt: new Date(),
          succeeded: true,
          resultJson: { blogId, publicationId },
        },
      }),
    ]);
  }

  private async failScheduledGeneration(
    record: { inputJson: Prisma.JsonValue },
    error: unknown,
  ) {
    const schedule = (record.inputJson as any)?.__schedule;
    if (!schedule?.scheduleId || !schedule?.runId) return;
    const message = error instanceof Error ? error.message : 'Generation failed.';
    await this.prisma.$transaction([
      this.prisma.blogSchedule.update({
        where: { id: schedule.scheduleId },
        data: { status: 'FAILED' },
      }),
      this.prisma.blogScheduleRun.update({
        where: { id: schedule.runId },
        data: { completedAt: new Date(), succeeded: false, errorMessage: message.slice(0, 1000) },
      }),
    ]);
  }
}

async function uniqueSlug(tx: Prisma.TransactionClient, organizationId: string, base: string) {
  let candidate = base || 'untitled-blog';
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const exists = await tx.blogDocument.findUnique({
      where: { organizationId_slug: { organizationId, slug: candidate } },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}
