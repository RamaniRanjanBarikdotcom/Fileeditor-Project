import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UrlInspectorService } from './url-inspector.service';
import { UrlSecurityService } from '@docconv/url-security';

@Module({
  controllers: [FilesController],
  providers: [FilesService, UrlInspectorService, UrlSecurityService],
  exports: [FilesService],
})
export class FilesModule {}
