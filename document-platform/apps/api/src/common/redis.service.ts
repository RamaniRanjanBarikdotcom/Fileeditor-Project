import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client?: Redis;
  private readonly memory = new Map<string, { value: string; expiresAt?: number }>();
  private enabled = true;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.enabled = this.config.get<string>('REDIS_ENABLED', 'true') !== 'false';
    if (!this.enabled) {
      console.warn('ℹ️ [RedisService] Using process-local quota storage; counters reset on restart.');
      return;
    }
    const host = this.config.get<string>('REDIS_HOST', 'localhost');
    const port = parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10);
    const password = this.config.get<string>('REDIS_PASSWORD') || undefined;

    this.client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    this.client.connect().catch((err) => {
      console.warn('⚠️ [RedisService] Redis connection error:', err.message);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  getClient(): Redis {
    if (!this.client) throw new Error('Redis is disabled in this deployment.');
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.enabled || !this.client) {
      const item = this.memory.get(key);
      if (!item) return null;
      if (item.expiresAt && item.expiresAt <= Date.now()) {
        this.memory.delete(key);
        return null;
      }
      return item.value;
    }
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.enabled || !this.client) {
      this.memory.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      });
      return;
    }
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.warn('⚠️ [RedisService] set error:', err);
    }
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    if (!this.enabled || !this.client) {
      const current = Number((await this.get(key)) || 0) + 1;
      await this.set(key, String(current), ttlSeconds);
      return current;
    }
    try {
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, ttlSeconds);
      const results = await multi.exec();
      const count = results?.[0]?.[1] as number;
      return typeof count === 'number' ? count : 1;
    } catch (err) {
      console.warn('⚠️ [RedisService] incrWithTtl fallback:', err);
      return 1;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.enabled || !this.client) {
      this.memory.delete(key);
      return;
    }
    try {
      await this.client.del(key);
    } catch {}
  }

  async decrementFloorZero(key: string): Promise<number> {
    if (!this.enabled || !this.client) {
      const current = Math.max(0, Number((await this.get(key)) || 0) - 1);
      const existing = this.memory.get(key);
      this.memory.set(key, { value: String(current), expiresAt: existing?.expiresAt });
      return current;
    }
    try {
      return Number(
        await this.client.eval(
          "local n=tonumber(redis.call('GET', KEYS[1]) or '0'); if n > 0 then return redis.call('DECR', KEYS[1]) end; return 0",
          1,
          key,
        ),
      );
    } catch {
      return 0;
    }
  }
}
