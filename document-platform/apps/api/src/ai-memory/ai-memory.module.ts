import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiProjectsController } from './ai-projects.controller';
import { AiProjectsService } from './ai-projects.service';
import { AiProvider, OpenAiCompatibleProvider } from './ai-provider.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ContextBuilderService } from './context-builder.service';
import { MemoriesController } from './memories.controller';
import { MemoryAccessService } from './memory-access.service';
import { MemoryConfigService } from './memory.config';
import { MEMORY_QUEUE, MemoryJobsService } from './memory-jobs.service';
import { MemoryMaintenanceService } from './memory-maintenance.service';
import { MemoryProcessor } from './memory.processor';
import { MemoryService } from './memory.service';

const queuesEnabled = process.env.REDIS_ENABLED !== 'false';
const disabledQueue = {
  add: async () => {
    throw new Error('Redis queue is disabled.');
  },
};

@Module({
  imports: queuesEnabled ? [BullModule.registerQueue({ name: MEMORY_QUEUE })] : [],
  controllers: [AiProjectsController, ConversationsController, MemoriesController],
  providers: [
    MemoryConfigService,
    MemoryAccessService,
    MemoryService,
    ContextBuilderService,
    MemoryMaintenanceService,
    MemoryJobsService,
    AiProjectsService,
    ConversationsService,
    OpenAiCompatibleProvider,
    { provide: AiProvider, useExisting: OpenAiCompatibleProvider },
    ...(queuesEnabled
      ? [MemoryProcessor]
      : [{ provide: getQueueToken(MEMORY_QUEUE), useValue: disabledQueue }]),
  ],
  exports: [MemoryService, ContextBuilderService, AiProvider],
})
export class AiMemoryModule {}
