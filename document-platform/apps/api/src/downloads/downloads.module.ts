import { Module } from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { DownloadsController } from './downloads.controller';
import { PrismaModule } from '../common/prisma.module';
import { LicensesModule } from '../licenses/licenses.module';

@Module({
  imports: [PrismaModule, LicensesModule],
  controllers: [DownloadsController],
  providers: [DownloadsService],
  exports: [DownloadsService],
})
export class DownloadsModule {}
