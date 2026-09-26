import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  MEMORY_JOB_MAINTAIN,
  MEMORY_JOB_CLEANUP,
  MEMORY_JOB_PROJECT_SUMMARY,
  MEMORY_QUEUE,
} from './memory-jobs.service';
import { MemoryMaintenanceService } from './memory-maintenance.service';

@Processor(MEMORY_QUEUE)
export class MemoryProcessor extends WorkerHost {
  constructor(private readonly maintenance: MemoryMaintenanceService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === MEMORY_JOB_MAINTAIN) {
      const { conversationId, sourceMessageId, projectId } = job.data as {
        conversationId: string;
        sourceMessageId: string;
        projectId: string;
      };
      const extraction = await this.maintenance.extract(conversationId, sourceMessageId);
      const [session, project] = await Promise.all([
        this.maintenance.summarizeConversation(conversationId),
        this.maintenance.refreshProjectSummary(projectId),
      ]);
      return { extraction, session, project };
    }
    if (job.name === MEMORY_JOB_PROJECT_SUMMARY) {
      return this.maintenance.refreshProjectSummary(
        String(job.data.projectId),
        Boolean(job.data.force),
      );
    }
    if (job.name === MEMORY_JOB_CLEANUP) {
      return this.maintenance.cleanupRetention();
    }
    return { skipped: true, reason: 'unknown_job' };
  }
}
