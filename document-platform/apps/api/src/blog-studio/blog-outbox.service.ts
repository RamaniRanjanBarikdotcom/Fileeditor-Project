import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { BLOG_STUDIO_QUEUE } from './blog-studio.constants';

@Injectable()
export class BlogOutboxService implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BLOG_STUDIO_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit() {
    if (process.env.REDIS_ENABLED === 'false') return;
    void this.publishPending();
    this.interval = setInterval(() => void this.publishPending(), 2_000);
    this.interval.unref();
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async publishPending() {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const staleBefore = new Date(Date.now() - 60_000);
      await this.prisma.outboxEvent.updateMany({
        where: {
          aggregateType: 'BlogGenerationJob',
          status: OutboxStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
        data: {
          status: OutboxStatus.FAILED,
          nextAttemptAt: new Date(),
          lastError: 'Recovered an interrupted Blog Studio outbox publish.',
        },
      });
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'BlogGenerationJob',
          status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true },
      });
      for (const event of events) await this.publish(event.id);
    } finally {
      this.publishing = false;
    }
  }

  async publish(id: string) {
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        aggregateType: 'BlogGenerationJob',
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        nextAttemptAt: { lte: new Date() },
      },
      data: { status: OutboxStatus.PROCESSING, attemptCount: { increment: 1 } },
    });
    if (claimed.count !== 1) return false;
    const event = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!event) return false;
    try {
      await this.queue.add(
        'generate-blog',
        { jobId: event.aggregateId },
        {
          jobId: event.aggregateId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 86_400, count: 5_000 },
          removeOnFail: { age: 604_800, count: 5_000 },
        },
      );
      await this.prisma.outboxEvent.update({
        where: { id },
        data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date(), lastError: null },
      });
      return true;
    } catch (error) {
      await this.prisma.outboxEvent.update({
        where: { id },
        data: {
          status: OutboxStatus.FAILED,
          nextAttemptAt: new Date(
            Date.now() + Math.min(60, 2 ** Math.min(event.attemptCount, 5)) * 1_000,
          ),
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
        },
      });
      return false;
    }
  }
}
