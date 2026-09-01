import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis.service';
import * as crypto from 'crypto';

export interface AnonymousQuotaStatus {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  anonId: string;
  resetInSeconds: number;
}

const ANON_DAILY_LIMIT = 3;
const ANON_COOKIE_NAME = 'toolsuite_anon_id';

@Injectable()
export class AnonymousQuotaService {
  private readonly hmacSecret: string;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.hmacSecret = this.config.get<string>(
      'IP_HMAC_SECRET',
      'toolsuite-default-ip-salt-change-in-production-2026',
    );
  }

  /**
   * Generates or extracts signed anonymous identity from cookies & headers.
   */
  getOrCreateAnonId(cookies?: Record<string, string>): { anonId: string; isNew: boolean } {
    const existing = cookies?.[ANON_COOKIE_NAME];
    if (existing && existing.includes('.')) {
      const parts = existing.split('.');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const [id, signature] = parts;
        const expectedSig = this.signAnonId(id);
        if (signature === expectedSig) {
          return { anonId: id, isNew: false };
        }
      }
    }

    const newId = crypto.randomUUID();
    return { anonId: newId, isNew: true };
  }

  /**
   * Signs the anonymous ID to create a tamper-resistant cookie payload.
   */
  createSignedCookieValue(anonId: string): string {
    const sig = this.signAnonId(anonId);
    return `${anonId}.${sig}`;
  }

  /**
   * Computes a privacy-safe HMAC-SHA256 of client IP using server salt.
   */
  computeIpHmac(ip: string): string {
    const cleanIp = ip.replace(/^.*:/, '').trim(); // normalize IPv4-mapped IPv6
    return crypto.createHmac('sha256', this.hmacSecret).update(cleanIp).digest('hex').slice(0, 32);
  }

  /**
   * Check and increment anonymous usage count in Redis.
   */
  async consumeQuota(ip: string, anonId: string): Promise<AnonymousQuotaStatus> {
    const ipHash = this.computeIpHmac(ip);
    const redisKey = `quota:anon:${ipHash}:${anonId}`;
    const ttlSeconds = 24 * 60 * 60; // 24 hours

    const used = await this.redis.incrWithTtl(redisKey, ttlSeconds);
    const remaining = Math.max(0, ANON_DAILY_LIMIT - used);
    const allowed = used <= ANON_DAILY_LIMIT;

    if (!allowed) {
      throw new ForbiddenException(
        `Anonymous limit reached (${ANON_DAILY_LIMIT} free operations/day). Create a free account or upgrade to Pro for higher limits!`,
      );
    }

    return {
      allowed: true,
      limit: ANON_DAILY_LIMIT,
      used,
      remaining,
      anonId,
      resetInSeconds: ttlSeconds,
    };
  }

  /**
   * Read current quota status without incrementing.
   */
  async checkQuota(ip: string, anonId: string): Promise<AnonymousQuotaStatus> {
    const ipHash = this.computeIpHmac(ip);
    const redisKey = `quota:anon:${ipHash}:${anonId}`;

    const raw = await this.redis.get(redisKey);
    const used = raw ? parseInt(raw, 10) : 0;
    const remaining = Math.max(0, ANON_DAILY_LIMIT - used);

    return {
      allowed: used < ANON_DAILY_LIMIT,
      limit: ANON_DAILY_LIMIT,
      used,
      remaining,
      anonId,
      resetInSeconds: 24 * 60 * 60,
    };
  }

  async releaseQuota(ip: string, anonId: string): Promise<void> {
    const ipHash = this.computeIpHmac(ip);
    const redisKey = `quota:anon:${ipHash}:${anonId}`;
    try {
      await this.redis.getClient().eval(
        "local n=tonumber(redis.call('GET', KEYS[1]) or '0'); if n > 0 then return redis.call('DECR', KEYS[1]) end; return 0",
        1,
        redisKey,
      );
    } catch {
      // A failed refund must not hide the original conversion error.
    }
  }

  private signAnonId(id: string): string {
    return crypto.createHmac('sha256', this.hmacSecret).update(id).digest('hex').slice(0, 16);
  }
}
