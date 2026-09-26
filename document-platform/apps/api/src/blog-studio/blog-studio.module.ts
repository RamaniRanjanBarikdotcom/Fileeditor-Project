import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module, ServiceUnavailableException } from '@nestjs/common';
import { AiMemoryModule } from '../ai-memory/ai-memory.module';
import { ConversionsModule } from '../conversions/conversions.module';
import { FilesModule } from '../files/files.module';
import { BlogAiAdapter } from './blog-ai.adapter';
import { BlogOutboxService } from './blog-outbox.service';
import { BlogStudioController } from './blog-studio.controller';
import { BlogStudioProcessor } from './blog-studio.processor';
import { BLOG_STUDIO_QUEUE } from './blog-studio.constants';
import { BlogStudioService } from './blog-studio.service';
import { BlogUsageService } from './blog-usage.service';
import { BlogWebsiteContextService } from './blog-website-context.service';

import { BlogSettingsService } from './blog-settings.service';
import { EncryptionService } from './encryption.service';
import { BlogProvidersService } from './blog-providers.service';
import { BlogPublishingService } from './blog-publishing.service';
import { BlogSchedulerService } from './blog-scheduler.service';
import { BlogProductsService } from './blog-products.service';
import { BlogImagesService } from './blog-images.service';
import { BlogAnalyticsService } from './blog-analytics.service';
import { BlogLogsService } from './blog-logs.service';
import { BlogPermissionsService } from './blog-permissions.service';
import { BlogNotificationsService } from './blog-notifications.service';
import { BlogResearchService } from './blog-research.service';

const queuesEnabled = process.env.REDIS_ENABLED !== 'false';
const disabledQueue = {
  add: async () => {
    throw new ServiceUnavailableException(
      'Blog Studio generation workers are disabled in this deployment.',
    );
  },
};

@Module({
  imports: [
    AiMemoryModule,
    FilesModule,
    ConversionsModule,
    ...(queuesEnabled ? [BullModule.registerQueue({ name: BLOG_STUDIO_QUEUE })] : []),
  ],
  controllers: [BlogStudioController],
  providers: [
    BlogStudioService,
    BlogUsageService,
    BlogAiAdapter,
    BlogWebsiteContextService,
    BlogOutboxService,
    BlogSettingsService,
    EncryptionService,
    BlogProvidersService,
    BlogPublishingService,
    BlogSchedulerService,
    BlogProductsService,
    BlogImagesService,
    BlogAnalyticsService,
    BlogLogsService,
    BlogPermissionsService,
    BlogNotificationsService,
    BlogResearchService,
    ...(queuesEnabled
      ? [BlogStudioProcessor]
      : [{ provide: getQueueToken(BLOG_STUDIO_QUEUE), useValue: disabledQueue }]),
  ],
  exports: [BlogStudioService, BlogUsageService, BlogPermissionsService, BlogSettingsService, BlogProvidersService],
})
export class BlogStudioModule {}
