import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { FilesModule } from './files/files.module';
import { ConversionsModule } from './conversions/conversions.module';
import { TemplatesModule } from './templates/templates.module';
import { PresetsModule } from './presets/presets.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    // ─── Configuration ──────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // ─── Rate Limiting ──────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1 second
        limit: 10,    // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000,   // 1 minute
        limit: 100,   // 100 requests per minute
      },
    ]),

    // ─── BullMQ Queues ──────────────────────────────────────
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // ─── Database ───────────────────────────────────────────
    PrismaModule,

    // ─── Feature Modules ────────────────────────────────────
    AuthModule,
    UsersModule,
    OrganizationsModule,
    FilesModule,
    ConversionsModule,
    TemplatesModule,
    PresetsModule,
    HealthModule,
    EventsModule,
  ],
})
export class AppModule {}
