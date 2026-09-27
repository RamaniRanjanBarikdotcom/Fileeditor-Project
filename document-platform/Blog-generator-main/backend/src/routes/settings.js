// Settings channels — ports of the settings-related ipcMain handlers.
import { authed } from './_util.js';
import { getSetting, setSetting, logActivity, getUserById } from '../db/actions.js';
import {
  normalizeShopifyOauthClients,
  sanitizeShopifyOauthClientsForUi,
} from '../lib/shopify-secrets.js';
import { serverCallbackUrl } from '../services/shopifyOauth.js';
import { config } from '../config/env.js';

const userSettingsKey = (id) => `user_settings_${id}`;
const apiKeyKey = (id) => `api_key_${id}`;

export default async function settingsRoutes(app) {
  app.post('/api/save-api-key', authed(async (ctx, body) => {
    ctx.requirePermission('settings');
    const apiKey = body.apiKey ?? body; // preload sent the bare string
    await setSetting({ userId: ctx.user.id, key: apiKeyKey(ctx.user.id), value: apiKey });
    await logActivity({ userId: ctx.user.id, action: 'settings.saveApiKey', details: 'Saved OpenAI API key' });
    return { success: true };
  }));

  app.post('/api/get-api-key', authed(async (ctx) => {
    ctx.requirePermission('settings');
    const apiKey = await getSetting({ userId: ctx.user.id, key: apiKeyKey(ctx.user.id) });
    return { success: true, apiKey: apiKey || '' };
  }));

  app.post('/api/save-settings', authed(async (ctx, body) => {
    ctx.requirePermission('settings');
    const settings = body && typeof body === 'object' ? body : {};
    const rawExisting = await getSetting({ userId: ctx.user.id, key: userSettingsKey(ctx.user.id) });
    const existingSettings = rawExisting ? safeParse(rawExisting) : {};
    const existingOauthClients = Array.isArray(existingSettings.shopifyOauthClients)
      ? existingSettings.shopifyOauthClients
      : [];
    const incomingOauthClients = Array.isArray(settings.shopifyOauthClients)
      ? settings.shopifyOauthClients
      : null;
    const normalizedOauthClients = incomingOauthClients
      ? normalizeShopifyOauthClients(incomingOauthClients, existingOauthClients)
      : existingOauthClients;
    const settingsToStore = { ...settings, shopifyOauthClients: normalizedOauthClients };
    await setSetting({ userId: ctx.user.id, key: userSettingsKey(ctx.user.id), value: JSON.stringify(settingsToStore) });
    await logActivity({ userId: ctx.user.id, action: 'settings.save', details: 'Saved user settings' });
    return { success: true };
  }));

  app.post('/api/get-settings', authed(async (ctx) => {
    ctx.requirePermission('settings');
    const raw = await getSetting({ userId: ctx.user.id, key: userSettingsKey(ctx.user.id) });
    const parsed = raw ? safeParse(raw) : {};
    const oauthClients = Array.isArray(parsed.shopifyOauthClients) ? parsed.shopifyOauthClients : [];
    parsed.shopifyOauthClients = sanitizeShopifyOauthClientsForUi(oauthClients);
    // The web backend IS the server side: OAuth apps + tokens are managed via the
    // dedicated shopify-oauth-* channels (server-stored), and the redirect target is
    // this backend's public callback.
    parsed.shopifyServerOauthEnabled = true;
    parsed.shopifyOauthRedirectUrl = serverCallbackUrl();
    return { success: true, settings: parsed };
  }));

  app.post('/api/get-publish-destinations', authed(async (ctx) => {
    ctx.requireAnyPermission(['scheduler', 'settings']);
    const settings = await ctx.getUserSettings();
    const destinations = Array.isArray(settings.publishDestinations) ? settings.publishDestinations : [];
    return { success: true, destinations };
  }));

  app.post('/api/update-settings', authed(async (ctx, body) => {
    ctx.requirePermission('settings');
    const updates = body && typeof body === 'object' ? body : {};
    const raw = await getSetting({ userId: ctx.user.id, key: userSettingsKey(ctx.user.id) });
    const existing = raw ? safeParse(raw) : {};
    const next = { ...existing, ...updates };
    const existingOauthClients = Array.isArray(existing.shopifyOauthClients) ? existing.shopifyOauthClients : [];
    if (Array.isArray(updates.shopifyOauthClients)) {
      next.shopifyOauthClients = normalizeShopifyOauthClients(updates.shopifyOauthClients, existingOauthClients);
    }
    await setSetting({ userId: ctx.user.id, key: userSettingsKey(ctx.user.id), value: JSON.stringify(next) });
    await logActivity({ userId: ctx.user.id, action: 'settings.update', details: 'Updated user settings' });
    return { success: true, settings: next };
  }));

  // ---- admin: per-user keys & settings ----
  app.post('/api/get-user-api-key', authed(async (ctx, { userId }) => {
    ctx.requirePermission('manageUsers');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    const apiKey = await getSetting({ userId, key: apiKeyKey(userId) });
    return { success: true, apiKey: apiKey || '' };
  }));

  app.post('/api/save-user-api-key', authed(async (ctx, { userId, apiKey }) => {
    ctx.requirePermission('manageUsers');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    await setSetting({ userId, key: apiKeyKey(userId), value: apiKey });
    await logActivity({ userId: ctx.user.id, action: 'admin.updateUserSettings', details: `Updated API key for "${user.username}"` });
    return { success: true };
  }));

  app.post('/api/get-user-settings', authed(async (ctx, { userId }) => {
    ctx.requirePermission('manageUsers');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    const raw = await getSetting({ userId, key: userSettingsKey(userId) });
    return { success: true, settings: raw ? safeParse(raw) : {} };
  }));

  app.post('/api/save-user-settings', authed(async (ctx, { userId, settings }) => {
    ctx.requirePermission('manageUsers');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    await setSetting({ userId, key: userSettingsKey(userId), value: JSON.stringify(settings || {}) });
    await logActivity({ userId: ctx.user.id, action: 'admin.updateUserSettings', details: `Updated settings for "${user.username}"` });
    return { success: true };
  }));

  // ---- server/db config: managed by the deployment, not the client ----
  app.post('/api/get-mongodb-config', authed(async () => ({
    success: true,
    config: { uri: 'server-managed', dbName: 'server-managed', isConfigured: true },
  })));
  app.post('/api/save-mongodb-config', authed(async () => ({ success: true, message: 'MongoDB is managed by the server deployment' })));
  app.post('/api/test-mongodb-connection', authed(async () => ({ success: true, message: 'Managed by server' })));
  // On the web the backend IS the server API, so it's always "enabled/configured".
  // SchedulerPage gates its UI on the top-level `enabled` flag.
  app.post('/api/get-server-api-config', authed(async () => ({
    success: true,
    enabled: true,
    baseUrl: config.publicApiUrl,
    timeoutMs: 0,
    serverManaged: true,
    config: { baseUrl: config.publicApiUrl, timeoutMs: 0, isConfigured: true, serverManaged: true },
  })));
  app.post('/api/save-server-api-config', authed(async () => ({ success: true })));
  app.post('/api/test-server-api-config', authed(async () => ({ success: true })));
}

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
