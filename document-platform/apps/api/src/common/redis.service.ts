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
      console.warn(
        'ℹ️ [RedisService] Using process-local quota storage; counters reset on restart.',
      );
      return;
    }
    const redisUrl = this.config.get<string>('REDIS_URL');
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 100, 3000);
      },
    };

    if (redisUrl) {
      this.client = new Redis(redisUrl, options);
    } else {
      const host = this.config.get<string>('REDIS_HOST', 'localhost');
      const port = parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10);
      const password = this.config.get<string>('REDIS_PASSWORD') || undefined;
      this.client = new Redis({
        host,
        port,
        password,
        ...options,
      });
    }

    this.client.connect().catch((err) => {
      console.warn('⚠️ [RedisService] Redis connection error:', err.message);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async ping(): Promise<boolean> {
    if (!this.enabled) return true;
    if (!this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
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
      if (typeof count !== 'number') {
        throw new Error('Redis returned an invalid quota counter result.');
      }
      return count;
    } catch (err) {
      console.warn('⚠️ [RedisService] incrWithTtl failed:', err);
      throw new Error('Redis quota storage is unavailable.');
    }
  }

  async reserveQuotaPair(
    deviceKey: string,
    ipKey: string,
    deviceLimit: number,
    ipLimit: number,
    ttlSeconds: number,
  ): Promise<{ allowed: boolean; deviceUsed: number; ipUsed: number }> {
    if (!this.enabled || !this.client) {
      const deviceUsed = Number((await this.get(deviceKey)) || 0);
      const ipUsed = Number((await this.get(ipKey)) || 0);
      if (deviceUsed >= deviceLimit || ipUsed >= ipLimit) {
        return { allowed: false, deviceUsed, ipUsed };
      }
      const nextDevice = deviceUsed + 1;
      const nextIp = ipUsed + 1;
      await this.set(deviceKey, String(nextDevice), ttlSeconds);
      await this.set(ipKey, String(nextIp), ttlSeconds);
      return { allowed: true, deviceUsed: nextDevice, ipUsed: nextIp };
    }

    const script = `
      local device = tonumber(redis.call('GET', KEYS[1]) or '0')
      local ip = tonumber(redis.call('GET', KEYS[2]) or '0')
      if device >= tonumber(ARGV[1]) or ip >= tonumber(ARGV[2]) then
        return {0, device, ip}
      end
      device = redis.call('INCR', KEYS[1])
      ip = redis.call('INCR', KEYS[2])
      if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
      if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
      return {1, device, ip}
    `;

    try {
      const result = (await this.client.eval(
        script,
        2,
        deviceKey,
        ipKey,
        deviceLimit,
        ipLimit,
        ttlSeconds,
      )) as number[];
      return {
        allowed: Number(result[0]) === 1,
        deviceUsed: Number(result[1]),
        ipUsed: Number(result[2]),
      };
    } catch (error) {
      console.warn('⚠️ [RedisService] atomic quota reservation failed:', error);
      throw new Error('Redis quota storage is unavailable.');
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

  async keys(pattern: string): Promise<string[]> {
    if (!this.enabled || !this.client) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(this.memory.keys()).filter((k) => regex.test(k));
    }
    try {
      return await this.client.keys(pattern);
    } catch {
      return [];
    }
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
