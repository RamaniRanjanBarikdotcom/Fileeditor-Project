import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@docconv/shared-types';
import { ConversionsController } from './conversions.controller';
import { ConversionsService } from './conversions.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.HTML }),
    BullModule.registerQueue({ name: QUEUE_NAMES.OFFICE }),
    BullModule.registerQueue({ name: QUEUE_NAMES.MARKDOWN }),
    BullModule.registerQueue({ name: QUEUE_NAMES.DATA }),
    BullModule.registerQueue({ name: QUEUE_NAMES.DOCUMENT }),
    BullModule.registerQueue({ name: QUEUE_NAMES.IMAGE }),
    BullModule.registerQueue({ name: QUEUE_NAMES.PDF }),
  ],
  controllers: [ConversionsController],
  providers: [ConversionsService],
  exports: [ConversionsService],
})
export class ConversionsModule {}
