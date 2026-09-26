import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { AnonymousQuotaService } from './anonymous-quota.service';
import { AnonymousToolsService } from './anonymous-tools.service';
import { FilesModule } from '../files/files.module';
import { ConversionsModule } from '../conversions/conversions.module';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Module({
  imports: [FilesModule, ConversionsModule],
  controllers: [ToolsController],
  providers: [ToolsService, AnonymousQuotaService, AnonymousToolsService, OptionalJwtAuthGuard],
  exports: [ToolsService, AnonymousQuotaService],
})
export class ToolsModule {}
