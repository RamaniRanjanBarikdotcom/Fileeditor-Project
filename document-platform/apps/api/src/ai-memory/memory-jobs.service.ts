import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { apiLogger } from '@docconv/logging';
import { MemoryMaintenanceService } from './memory-maintenance.service';

export const MEMORY_QUEUE = 'ai-memory';
export const MEMORY_JOB_MAINTAIN = 'memory-maintain-after-message';
export const MEMORY_JOB_PROJECT_SUMMARY = 'memory-project-summary';
export const MEMORY_JOB_CLEANUP = 'memory-retention-cleanup';

@Injectable()
export class MemoryJobsService {
  private readonly queuesEnabled = process.env.REDIS_ENABLED !== 'false';

  constructor(
    @InjectQueue(MEMORY_QUEUE) private readonly queue: Queue,
    private readonly maintenance: MemoryMaintenanceService,
  ) {}

  async afterMessage(conversationId: string, sourceMessageId: string, projectId: string) {
    if (this.queuesEnabled) {
      try {
        await this.queue.add(
          MEMORY_JOB_MAINTAIN,
          { conversationId, sourceMessageId, projectId },
          {
            jobId: `memory:${sourceMessageId}`,
            attempts: 4,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: 500,
            removeOnFail: 1_000,
          },
        );
        await this.queue.add(
          MEMORY_JOB_CLEANUP,
          {},
          {
            jobId: `memory-cleanup:${new Date().toISOString().slice(0, 10)}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 30,
            removeOnFail: 100,
          },
        );
        return;
      } catch (error) {
        apiLogger.warn({ conversationId, error: error instanceof Error ? error.message : String(error) }, 'memory_queue_unavailable_inline_fallback');
      }
    }
    void this.runInline(conversationId, sourceMessageId, projectId);
  }

  async refreshProject(projectId: string) {
    if (this.queuesEnabled) {
      try {
        await this.queue.add(
          MEMORY_JOB_PROJECT_SUMMARY,
          { projectId, force: true },
          {
            jobId: `memory-summary:${projectId}:${Math.floor(Date.now() / 300_000)}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );
        return;
      } catch (error) {
        apiLogger.warn({ projectId, error: error instanceof Error ? error.message : String(error) }, 'memory_summary_queue_unavailable');
      }
    }
    void this.maintenance.refreshProjectSummary(projectId, true);
  }

  private async runInline(conversationId: string, sourceMessageId: string, projectId: string) {
    await this.maintenance.extract(conversationId, sourceMessageId);
    await Promise.allSettled([
      this.maintenance.summarizeConversation(conversationId),
      this.maintenance.refreshProjectSummary(projectId),
      this.maintenance.cleanupRetention(),
    ]);
  }
}
