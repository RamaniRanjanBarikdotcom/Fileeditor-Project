import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ConfigService } from '@nestjs/config';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import { ClamAvScanner } from '../files/clamav.scanner';

type ServiceStatus = {
  status: 'up' | 'down' | 'degraded' | 'pending' | 'disabled';
  error?: string;
  [key: string]: unknown;
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  private storageClient?: StorageClient;
  private readonly clamScanner = new ClamAvScanner();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    try {
      this.storageClient = new StorageClient(
        createStorageConfig(process.env as Record<string, string | undefined>),
      );
    } catch {
      this.storageClient = undefined;
    }
  }

  /**
   * Fast liveness probe — confirms the process is alive and can respond.
   * Kubernetes: livenessProbe
   */
  @Get('live')
  @ApiOperation({ summary: 'Fast liveness probe' })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Backward-compatible alias for liveness
   */
  @Get('liveness')
  @ApiOperation({ summary: 'Fast liveness probe (alias)' })
  liveness() {
    return this.live();
  }

  /**
   * Deep readiness probe — checks every required dependency.
   * Returns HTTP 503 if any required component is down.
   * Kubernetes: readinessProbe
   */
  @Get('ready')
  @ApiOperation({ summary: 'Deep readiness probe' })
  async ready(@Res({ passthrough: false }) res: Response) {
    return this.deepCheck(res);
  }

  /**
   * Default health endpoint — same as readiness.
   */
  @Get()
  @ApiOperation({ summary: 'Deep readiness probe (default)' })
  async check(@Res({ passthrough: false }) res: Response) {
    return this.deepCheck(res);
  }

  private async deepCheck(res: Response) {
    const timestamp = new Date().toISOString();
    const services: Record<string, ServiceStatus> = {};
    let hasFailure = false;
    const nativeEnabled = this.config.get<string>('PROCESSING_NATIVE_ENABLED') === 'true';

    // 1. Database — REQUIRED
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = { status: 'up' };
    } catch (err: any) {
      hasFailure = true;
      services.database = { status: 'down', error: err.message };
    }

    // 2. Redis — REQUIRED when enabled
    if (!this.redis.isEnabled()) {
      services.redis = { status: 'up', mode: 'in-memory' };
    } else {
      try {
        const isUp = await this.redis.ping();
        if (isUp) {
          services.redis = { status: 'up' };
        } else {
          hasFailure = true;
          services.redis = { status: 'down' };
        }
      } catch (err: any) {
        hasFailure = true;
        services.redis = { status: 'down', error: err.message };
      }
    }

    // 3. Storage — REQUIRED in production, degraded in development
    if (this.storageClient) {
      try {
        await this.storageClient.list('quarantine', undefined, 1);
        services.storage = { status: 'up' };
      } catch (err: any) {
        hasFailure = true;
        services.storage = { status: 'down', error: err.message };
      }
    } else {
      hasFailure = true;
      services.storage = { status: 'down', error: 'Storage client not initialized' };
    }

    // 4. Worker Heartbeat(s) — REQUIRED
    if (this.redis.isEnabled()) {
      try {
        // Enumerate all active worker heartbeat keys
        const keys = await this.redis.keys('worker:heartbeat:*');
        if (keys.length > 0) {
          const workerDetails: Record<string, unknown>[] = [];
          let anyStale = false;
          for (const key of keys) {
            const val = await this.redis.get(key);
            if (val) {
              let heartbeat: { timestamp: number; engines?: Record<string, boolean> };
              try {
                heartbeat = JSON.parse(val) as typeof heartbeat;
              } catch {
                heartbeat = { timestamp: parseInt(val, 10) };
              }
              const ageSeconds = Math.round((Date.now() - heartbeat.timestamp) / 1000);
              const workerId = key.replace('worker:heartbeat:', '');
              const missingEngines = Object.entries(heartbeat.engines || {})
                .filter(([, available]) => !available)
                .map(([name]) => name);
              workerDetails.push({
                id: workerId,
                lastHeartbeatSecondsAgo: ageSeconds,
                engines: heartbeat.engines,
                missingEngines,
              });
              if (ageSeconds > 45) anyStale = true;
              if (nativeEnabled && missingEngines.length > 0) anyStale = true;
            }
          }
          if (anyStale) {
            hasFailure = true;
            services.workers = { status: 'degraded', instances: workerDetails };
          } else {
            services.workers = { status: 'up', count: keys.length, instances: workerDetails };
          }
        } else {
          // Also check the legacy single-key heartbeat
          const legacyVal = await this.redis.get('worker:heartbeat');
          if (legacyVal) {
            const ageSeconds = Math.round((Date.now() - parseInt(legacyVal, 10)) / 1000);
            if (ageSeconds <= 45) {
              services.workers = { status: 'up', count: 1, lastHeartbeatSecondsAgo: ageSeconds, note: 'legacy single-key heartbeat' };
            } else {
              hasFailure = true;
              services.workers = { status: 'degraded', lastHeartbeatSecondsAgo: ageSeconds };
            }
          } else {
            hasFailure = true;
            services.workers = { status: 'down', error: 'No worker heartbeat recorded' };
          }
        }
      } catch {
        hasFailure = true;
        services.workers = { status: 'down', error: 'Cannot query worker heartbeats' };
      }
    } else {
      services.workers = { status: 'disabled', note: 'Redis not enabled; worker heartbeat not tracked' };
    }

    // 5. Gotenberg — REQUIRED when native processing is enabled
    const gotenbergUrl = this.config.get<string>('GOTENBERG_URL') || 'http://localhost:3100';
    if (nativeEnabled) {
      try {
        const gRes = await fetch(`${gotenbergUrl}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (gRes.ok) {
          services.gotenberg = { status: 'up' };
        } else {
          hasFailure = true;
          services.gotenberg = { status: 'down', error: `HTTP ${gRes.status}` };
        }
      } catch (err: any) {
        hasFailure = true;
        services.gotenberg = { status: 'down', error: err?.message || 'Connection refused' };
      }
    } else {
      services.gotenberg = { status: 'disabled', note: 'PROCESSING_NATIVE_ENABLED is not true' };
    }

    // 6. ClamAV — mandatory in production and whenever explicitly enabled.
    const clamRequired =
      process.env.NODE_ENV === 'production' || this.config.get<string>('CLAMAV_ENABLED') === 'true';
    if (clamRequired) {
      const clamUp = await this.clamScanner.ping();
      if (clamUp) {
        services.clamav = { status: 'up' };
      } else {
        hasFailure = true;
        services.clamav = { status: 'down', error: 'ClamAV is required but unavailable' };
      }
    } else {
      services.clamav = { status: 'disabled' };
    }

    // 7. BullMQ Queue Probe — REQUIRED when Redis is enabled
    if (this.redis.isEnabled()) {
      try {
        // Simple queue readiness: verify we can read from BullMQ namespace
        const queueKeys = await this.redis.keys('bull:*:id');
        services.queues = { status: 'up', registeredQueues: queueKeys.length };
      } catch (err: any) {
        hasFailure = true;
        services.queues = { status: 'down', error: err?.message };
      }
    }

    const overallStatus = hasFailure ? 'error' : 'ok';
    const httpStatus = hasFailure ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;

    return res.status(httpStatus).json({
      status: overallStatus,
      timestamp,
      uptime: process.uptime(),
      services,
    });
  }
}
