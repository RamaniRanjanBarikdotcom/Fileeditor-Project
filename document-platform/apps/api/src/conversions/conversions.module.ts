import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ServiceUnavailableException } from '@nestjs/common';
import { QUEUE_NAMES } from '@docconv/shared-types';
import { ConversionsController } from './conversions.controller';
import { ConversionsService } from './conversions.service';

const queueNames = Object.values(QUEUE_NAMES);
const redisQueuesEnabled = process.env.REDIS_ENABLED !== 'false';
const disabledQueue = {
  add: async () => {
    throw new ServiceUnavailableException(
      'Server conversion workers are disabled in this deployment. Use a browser-capable tool.',
    );
  },
  getJob: async () => null,
};

@Module({
  imports: redisQueuesEnabled
    ? queueNames.map((name) => BullModule.registerQueue({ name }))
    : [],
  controllers: [ConversionsController],
  providers: [
    ConversionsService,
    ...(!redisQueuesEnabled
      ? queueNames.map((name) => ({ provide: getQueueToken(name), useValue: disabledQueue }))
      : []),
  ],
  exports: [ConversionsService],
})
export class ConversionsModule {}
