// Server-side Shopify secret/token encryption — byte-compatible with the PHP
// blog-gen.php (shopifyEncryptSecret/shopifyDecryptSecret): AES-256-GCM with a key
// derived as sha256(encryption_key || jwt_secret), output `enc:ivhex:taghex:cipherhex`.
//
// This is intentionally a DIFFERENT key derivation than lib/shopify-secrets.js (which
// matches the desktop's settings-stored client secrets). This module is for the
// server-side `shopify_oauth_clients` / `shopify_connections` collections.

import crypto from 'node:crypto';
import { config } from '../config/env.js';

function key() {
  const seed = String(process.env.APP_ENCRYPTION_KEY || config.jwtSecret || '').trim();
  if (!seed) throw new Error('APP_ENCRYPTION_KEY or JWT_SECRET must be set for Shopify token encryption');
  return crypto.createHash('sha256').update(seed).digest(); // 32 raw bytes
}

export function encryptSecret(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('enc:')) return payload || '';
  const parts = payload.split(':');
  if (parts.length !== 4) return '';
  try {
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const data = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
