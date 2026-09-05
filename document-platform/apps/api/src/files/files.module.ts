import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UrlInspectorService } from './url-inspector.service';
import { UrlSecurityService } from '@docconv/url-security';
import { TempFileCleanupService } from './temp-file-cleanup.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, UrlInspectorService, UrlSecurityService, TempFileCleanupService],
  exports: [FilesService],
})
export class FilesModule {}
