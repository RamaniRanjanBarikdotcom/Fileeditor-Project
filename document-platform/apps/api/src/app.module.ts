import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';

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
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { ToolsModule } from './tools/tools.module';
import { CatalogModule } from './catalog/catalog.module';
import { CommerceModule } from './commerce/commerce.module';
import { PaymentsModule } from './payments/payments.module';
import { LicensesModule } from './licenses/licenses.module';
import { DownloadsModule } from './downloads/downloads.module';
import { PlatformRolesGuard } from './common/guards/platform-roles.guard';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard';

@Module({
  imports: [
    // ─── Configuration ──────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      // The repository-level file is canonical in native Node mode. Keep the
      // package-local fallback for backwards compatibility with older setups.
      envFilePath: ['../../.env', '.env'],
    }),

    // ─── Rate Limiting ──────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 20, // 20 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 200, // 200 requests per minute
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

    // ─── Core Platform Modules ──────────────────────────────
    FeatureFlagsModule,
    ToolsModule,
    CatalogModule,
    CommerceModule,
    PaymentsModule,
    LicensesModule,
    DownloadsModule,
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfOriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlatformRolesGuard,
    },
  ],
})
export class AppModule {}
