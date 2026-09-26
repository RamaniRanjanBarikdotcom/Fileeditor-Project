import { Injectable, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
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

const ANON_DEVICE_DAILY_LIMIT = 5;
const ANON_IP_DAILY_LIMIT = 15;
const ANON_COOKIE_NAME = 'apptoolkitlab_anon_id';
const LEGACY_ANON_COOKIE_NAME = 'toolsuite_anon_id';

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
    const existing = cookies?.[ANON_COOKIE_NAME] || cookies?.[LEGACY_ANON_COOKIE_NAME];
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

  private getKeys(ip: string, anonId: string) {
    const ipHash = this.computeIpHmac(ip);
    return {
      deviceKey: `quota:anon:device:${anonId}`,
      ipKey: `quota:anon:ip:${ipHash}`,
    };
  }

  /**
   * Check and increment anonymous usage count in Redis across both device and IP dimensions.
   */
  async consumeQuota(ip: string, anonId: string): Promise<AnonymousQuotaStatus> {
    const { deviceKey, ipKey } = this.getKeys(ip, anonId);
    const ttlSeconds = 24 * 60 * 60; // 24 hours

    let reservation;
    try {
      reservation = await this.redis.reserveQuotaPair(
        deviceKey,
        ipKey,
        ANON_DEVICE_DAILY_LIMIT,
        ANON_IP_DAILY_LIMIT,
        ttlSeconds,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Anonymous quota service is temporarily unavailable. No usage was consumed.',
      );
    }

    if (!reservation.allowed) {
      throw new ForbiddenException(
        `Anonymous limit reached. Create a free account for higher quotas and unlimited tools!`,
      );
    }

    const { deviceUsed } = reservation;

    const remaining = Math.max(0, ANON_DEVICE_DAILY_LIMIT - deviceUsed);

    return {
      allowed: true,
      limit: ANON_DEVICE_DAILY_LIMIT,
      used: deviceUsed,
      remaining,
      anonId,
      resetInSeconds: ttlSeconds,
    };
  }

  /**
   * Read current quota status without incrementing.
   */
  async checkQuota(ip: string, anonId: string): Promise<AnonymousQuotaStatus> {
    const { deviceKey, ipKey } = this.getKeys(ip, anonId);

    const [rawDevice, rawIp] = await Promise.all([
      this.redis.get(deviceKey),
      this.redis.get(ipKey),
    ]);

    const deviceUsed = rawDevice ? parseInt(rawDevice, 10) : 0;
    const ipUsed = rawIp ? parseInt(rawIp, 10) : 0;

    const remaining = Math.max(
      0,
      Math.min(ANON_DEVICE_DAILY_LIMIT - deviceUsed, ANON_IP_DAILY_LIMIT - ipUsed),
    );
    const allowed = deviceUsed < ANON_DEVICE_DAILY_LIMIT && ipUsed < ANON_IP_DAILY_LIMIT;

    return {
      allowed,
      limit: ANON_DEVICE_DAILY_LIMIT,
      used: deviceUsed,
      remaining,
      anonId,
      resetInSeconds: 24 * 60 * 60,
    };
  }

  async releaseQuota(ip: string, anonId: string): Promise<void> {
    const { deviceKey, ipKey } = this.getKeys(ip, anonId);
    await Promise.all([
      this.redis.decrementFloorZero(deviceKey),
      this.redis.decrementFloorZero(ipKey),
    ]);
  }

  private signAnonId(id: string): string {
    return crypto.createHmac('sha256', this.hmacSecret).update(id).digest('hex').slice(0, 16);
  }
}
