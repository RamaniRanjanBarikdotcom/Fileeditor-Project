import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBlogScheduleDto, UpdateBlogScheduleDto } from './blog-studio.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BLOG_STUDIO_QUEUE } from './blog-studio.constants';
import { BlogStudioService } from './blog-studio.service';
import { BlogPublishingService } from './blog-publishing.service';

@Injectable()
export class BlogSchedulerService {
  private readonly logger = new Logger(BlogSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BLOG_STUDIO_QUEUE) private readonly blogQueue: Queue,
    private readonly studio: BlogStudioService,
    private readonly publishing: BlogPublishingService,
  ) {}

  async listSchedules(organizationId: string) {
    return this.prisma.blogSchedule.findMany({
      where: { organizationId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        }
      }
    });
  }

  async createSchedule(organizationId: string, userId: string, dto: CreateBlogScheduleDto) {
    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date format.');
    }

    if (scheduledDate < new Date()) {
      throw new BadRequestException('Scheduled time must be in the future.');
    }

    const schedule = await this.prisma.blogSchedule.create({
      data: {
        organizationId,
        createdByUserId: userId,
        jobType: dto.jobType,
        scheduledAt: scheduledDate,
        timezone: dto.timezone || 'UTC',
        blogId: dto.blogId,
        destinationId: dto.destinationId,
        inputJson: (dto.inputJson || {}) as any,
        categoryId: dto.categoryId,
        generateImages: dto.generateImages || false,
        autoPublish: dto.autoPublish || false,
        status: 'PENDING',
      },
    });

    const delay = Math.max(0, scheduledDate.getTime() - Date.now());

    // Schedule the actual background job
    const job = await this.blogQueue.add(
      'process_schedule',
      { scheduleId: schedule.id, organizationId },
      { delay, jobId: `schedule-${schedule.id}` }
    );

    await this.prisma.blogSchedule.update({
      where: { id: schedule.id },
      data: { queueJobId: job.id },
    });

    return schedule;
  }

  async cancelSchedule(organizationId: string, scheduleId: string) {
    const schedule = await this.prisma.blogSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule || schedule.organizationId !== organizationId) {
      throw new NotFoundException('Schedule not found');
    }

    if (schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel a schedule with status ${schedule.status}`);
    }

    if (schedule.queueJobId) {
      try {
        const job = await this.blogQueue.getJob(schedule.queueJobId);
        if (job) {
          await job.remove();
        }
      } catch (error) {
        this.logger.warn(`Failed to remove job ${schedule.queueJobId} from queue`, error);
      }
    }

    return this.prisma.blogSchedule.update({
      where: { id: scheduleId },
      data: { status: 'CANCELLED' },
    });
  }

  async updateSchedule(
    organizationId: string,
    scheduleId: string,
    dto: UpdateBlogScheduleDto,
  ) {
    const schedule = await this.prisma.blogSchedule.findFirst({
      where: { id: scheduleId, organizationId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.status !== 'PENDING') {
      throw new BadRequestException('Only pending schedules can be edited.');
    }
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : schedule.scheduledAt;
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be a valid future date.');
    }
    if (schedule.queueJobId) {
      const previousJob = await this.blogQueue.getJob(schedule.queueJobId);
      if (previousJob) await previousJob.remove();
    }
    const updated = await this.prisma.blogSchedule.update({
      where: { id: scheduleId },
      data: {
        scheduledAt,
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.inputJson !== undefined ? { inputJson: dto.inputJson as any } : {}),
        ...(dto.destinationId !== undefined ? { destinationId: dto.destinationId || null } : {}),
        ...(dto.generateImages !== undefined ? { generateImages: dto.generateImages } : {}),
        ...(dto.autoPublish !== undefined ? { autoPublish: dto.autoPublish } : {}),
      },
    });
    const queueJob = await this.blogQueue.add(
      'process_schedule',
      { scheduleId: updated.id, organizationId },
      {
        delay: Math.max(0, scheduledAt.getTime() - Date.now()),
        jobId: `schedule-${updated.id}`,
      },
    );
    return this.prisma.blogSchedule.update({
      where: { id: updated.id },
      data: { queueJobId: queueJob.id },
    });
  }

  async deleteSchedule(organizationId: string, scheduleId: string) {
    const schedule = await this.prisma.blogSchedule.findFirst({
      where: { id: scheduleId, organizationId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.status === 'RUNNING') {
      throw new BadRequestException('A running schedule cannot be deleted. Cancel it first.');
    }
    if (schedule.queueJobId) {
      const queueJob = await this.blogQueue.getJob(schedule.queueJobId);
      if (queueJob) await queueJob.remove().catch(() => undefined);
    }
    await this.prisma.blogSchedule.delete({ where: { id: scheduleId } });
    return { deleted: true };
  }

  async processSchedule(scheduleId: string, organizationId: string) {
    const schedule = await this.prisma.blogSchedule.findFirst({
      where: { id: scheduleId, organizationId, status: 'PENDING' },
    });
    if (!schedule) return { skipped: true };
    const run = await this.prisma.blogScheduleRun.create({
      data: { scheduleId, startedAt: new Date() },
    });
    await this.prisma.blogSchedule.update({
      where: { id: scheduleId },
      data: { status: 'RUNNING' },
    });
    try {
      if (schedule.jobType === 'publish') {
        if (!schedule.blogId || !schedule.destinationId) {
          throw new BadRequestException('Publish schedules require a blog and destination.');
        }
        const publication = await this.publishing.publish(
          organizationId,
          schedule.createdByUserId,
          schedule.blogId,
          schedule.destinationId,
          schedule.autoPublish ? 'live' : 'draft',
        );
        await this.finishSchedule(schedule.id, run.id, { publicationId: publication.id });
        return { publicationId: publication.id };
      }

      const input = (schedule.inputJson || {}) as Record<string, any>;
      if (!input.topic) throw new BadRequestException('Generation schedules require a topic.');
      const generation = await this.studio.createGeneration(
        schedule.createdByUserId,
        organizationId,
        {
          topic: String(input.topic),
          keywords: Array.isArray(input.keywords) ? input.keywords.map(String) : [],
          focusKeyword: input.focusKeyword ? String(input.focusKeyword) : undefined,
          language: String(input.language || 'English'),
          writingStyle: String(input.writingStyle || 'Educational'),
          tone: String(input.tone || 'Professional'),
          targetLength: Number(input.targetLength || 1200),
          brandContext: input.brandContext ? String(input.brandContext) : undefined,
          brandWebsiteUrl: input.brandWebsiteUrl ? String(input.brandWebsiteUrl) : undefined,
        },
        {
          __schedule: {
            scheduleId: schedule.id,
            runId: run.id,
            destinationId: schedule.destinationId,
            publish: schedule.jobType === 'generate_and_publish' || schedule.autoPublish,
            publishedAs: schedule.autoPublish ? 'live' : 'draft',
          },
        },
      );
      return { generationJobId: generation.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduled operation failed.';
      await this.prisma.$transaction([
        this.prisma.blogSchedule.update({
          where: { id: schedule.id },
          data: { status: 'FAILED' },
        }),
        this.prisma.blogScheduleRun.update({
          where: { id: run.id },
          data: { completedAt: new Date(), succeeded: false, errorMessage: message.slice(0, 1000) },
        }),
      ]);
      throw error;
    }
  }

  private async finishSchedule(scheduleId: string, runId: string, result: Record<string, unknown>) {
    await this.prisma.$transaction([
      this.prisma.blogSchedule.update({ where: { id: scheduleId }, data: { status: 'COMPLETED' } }),
      this.prisma.blogScheduleRun.update({
        where: { id: runId },
        data: { completedAt: new Date(), succeeded: true, resultJson: result as any },
      }),
    ]);
  }

  // Used for bulk CSV imports that spawn multiple schedules
  async handleCsvImport(
    organizationId: string,
    userId: string,
    parsedRows: Array<Record<string, unknown>>,
    filename = 'import.csv',
  ) {
    const importRecord = await this.prisma.blogCsvImport.create({
      data: {
        organizationId,
        createdByUserId: userId,
        filename: filename.slice(0, 255),
        rowCount: parsedRows.length,
        status: 'importing'
      }
    });

    let createdCount = 0;
    
    for (const row of parsedRows) {
      if (row.topic && row.scheduledAt) {
        try {
          const scheduledDate = new Date(String(row.scheduledAt));
          if (scheduledDate > new Date()) {
            const created = await this.createSchedule(organizationId, userId, {
              jobType: 'generate',
              scheduledAt: scheduledDate.toISOString(),
              inputJson: {
                topic: String(row.topic),
                keywords: row.keywords ? String(row.keywords).split(',') : [],
                targetLength: Number.parseInt(String(row.targetLength || '1000'), 10) || 1000,
                language: String(row.language || 'English'),
                writingStyle: String(row.writingStyle || 'Educational'),
                tone: String(row.tone || 'Professional'),
              },
            });
            await this.prisma.blogSchedule.update({
              where: { id: created.id },
              data: { csvImportId: importRecord.id },
            });
            createdCount++;
          }
        } catch {
          // Invalid rows are counted below and do not stop valid rows.
        }
      }
    }

    return this.prisma.blogCsvImport.update({
      where: { id: importRecord.id },
      data: {
        status: 'completed',
        validCount: createdCount,
        errorCount: Math.max(0, parsedRows.length - createdCount),
      }
    });
  }
}
