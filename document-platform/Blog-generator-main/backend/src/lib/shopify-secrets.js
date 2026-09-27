// Shopify OAuth client-secret encryption — byte-for-byte compatible with the
// Electron app (src/main/index.js). Both share the same MongoDB user settings and
// the same APP_ENCRYPTION_KEY, so ciphertext must be portable across them.

import crypto from 'node:crypto';

const DEFAULT_ENCRYPTION_SEED = 'aiblog-generator::shopify-oauth::shared-key::v1';
export const SHOPIFY_SECRET_MASK = '••••••••';

function getEncryptionKey() {
  const seed =
    process.env.APP_ENCRYPTION_KEY ||
    process.env.SHOPIFY_OAUTH_STORE_KEY ||
    process.env.ELECTRON_STORE_KEY ||
    DEFAULT_ENCRYPTION_SEED;
  return crypto.createHash('sha256').update(String(seed)).digest();
}

export function encryptSecret(secret) {
  if (!secret) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('enc:')) return '';
  const [, ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function sanitizeShopifyOauthClientsForUi(list = []) {
  return list.map((client) => ({
    id: client.id,
    name: client.name || '',
    clientId: client.clientId || '',
    hasSecret: Boolean(client.clientSecretEnc),
    clientSecretMasked: client.clientSecretEnc ? SHOPIFY_SECRET_MASK : '',
    createdAt: client.createdAt || null,
    updatedAt: client.updatedAt || null,
  }));
}

export function normalizeShopifyOauthClients(incoming = [], existing = []) {
  const existingMap = new Map(existing.map((item) => [item.id, item]));
  return incoming
    .filter((client) => client && client.clientId)
    .map((client) => {
      const existingClient = existingMap.get(client.id);
      const next = {
        id: client.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: client.name || existingClient?.name || '',
        clientId: client.clientId || existingClient?.clientId || '',
        createdAt: existingClient?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const incomingSecret = String(client.clientSecret || '').trim();
      if (incomingSecret && incomingSecret !== SHOPIFY_SECRET_MASK) {
        next.clientSecretEnc = encryptSecret(incomingSecret);
      } else if (existingClient?.clientSecretEnc) {
        next.clientSecretEnc = existingClient.clientSecretEnc;
      } else {
        next.clientSecretEnc = '';
      }
      return next;
    });
}
