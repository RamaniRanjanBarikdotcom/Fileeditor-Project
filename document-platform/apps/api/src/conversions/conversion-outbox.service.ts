import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OutboxStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { ConversionJobData, QUEUE_NAMES } from '@docconv/shared-types';
import { PrismaService } from '../common/prisma.service';

type ConversionOutboxPayload = {
  queueName: string;
  jobData: ConversionJobData;
};

@Injectable()
export class ConversionOutboxService implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.HTML) private readonly htmlQueue: Queue,
    @InjectQueue(QUEUE_NAMES.OFFICE) private readonly officeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MARKDOWN) private readonly markdownQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DATA) private readonly dataQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DOCUMENT) private readonly documentQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IMAGE) private readonly imageQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF) private readonly pdfQueue: Queue,
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

  async publishPending(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const staleBefore = new Date(Date.now() - 60_000);
      await this.prisma.outboxEvent.updateMany({
        where: { status: OutboxStatus.PROCESSING, updatedAt: { lt: staleBefore } },
        data: {
          status: OutboxStatus.FAILED,
          nextAttemptAt: new Date(),
          lastError: 'Recovered an interrupted outbox publish.',
        },
      });

      const events = await this.prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'ConversionJob',
          status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
        select: { id: true },
      });
      for (const event of events) await this.publish(event.id);
    } finally {
      this.publishing = false;
    }
  }

  async publish(id: string): Promise<boolean> {
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        nextAttemptAt: { lte: new Date() },
      },
      data: { status: OutboxStatus.PROCESSING, attemptCount: { increment: 1 } },
    });
    if (claimed.count !== 1) return false;

    const event = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!event) return false;
    const payload = event.payloadJson as unknown as ConversionOutboxPayload;

    try {
      const queue = this.queueForName(payload.queueName);
      await queue.add('convert', payload.jobData, {
        jobId: event.aggregateId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 86_400, count: 10_000 },
        removeOnFail: { age: 604_800, count: 10_000 },
      });
      await this.prisma.outboxEvent.update({
        where: { id },
        data: {
          status: OutboxStatus.PUBLISHED,
          publishedAt: new Date(),
          lastError: null,
        },
      });
      return true;
    } catch (error) {
      const delaySeconds = Math.min(60, 2 ** Math.min(event.attemptCount, 5));
      await this.prisma.outboxEvent.update({
        where: { id },
        data: {
          status: OutboxStatus.FAILED,
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1_000),
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
        },
      });
      return false;
    }
  }

  private queueForName(name: string): Queue {
    const queues: Record<string, Queue> = {
      [QUEUE_NAMES.HTML]: this.htmlQueue,
      [QUEUE_NAMES.OFFICE]: this.officeQueue,
      [QUEUE_NAMES.MARKDOWN]: this.markdownQueue,
      [QUEUE_NAMES.DATA]: this.dataQueue,
      [QUEUE_NAMES.DOCUMENT]: this.documentQueue,
      [QUEUE_NAMES.IMAGE]: this.imageQueue,
      [QUEUE_NAMES.PDF]: this.pdfQueue,
    };
    const queue = queues[name];
    if (!queue) throw new Error(`Unknown conversion queue '${name}'.`);
    return queue;
  }
}
