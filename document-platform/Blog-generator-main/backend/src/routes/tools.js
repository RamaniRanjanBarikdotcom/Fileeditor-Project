// Tooling channels: API connection test, provider model listing, website scraping,
// product database, and link preview. Ports of the matching ipcMain handlers.
import { createRequire } from 'node:module';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { authed } from './_util.js';
import { getSetting, setSetting, logActivity } from '../db/actions.js';
import { testConnection, listProviderModels } from '../services/blogGenerator.js';

const require = createRequire(import.meta.url);
const ProductScraper = require('../services/productScraper.cjs');
const { customBaseUrl } = require('../services/aiProviders.cjs');

const UA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

export default async function toolsRoutes(app) {
  // Resolve a custom (user-defined) provider's base URL from the caller's saved settings,
  // unless the caller passed one explicitly (e.g. testing a not-yet-saved endpoint).
  const resolveBaseUrl = async (ctx, provider, explicit) => {
    if (explicit) return String(explicit).trim() || null;
    const raw = await getSetting({ userId: ctx.user.id, key: `user_settings_${ctx.user.id}` });
    const settings = raw ? safeParse(raw) : {};
    return customBaseUrl(settings.customProviders, provider);
  };

  app.post('/api/test-api-connection', authed(async (ctx, { apiKey, provider = 'openai', baseUrl = null } = {}) => {
    ctx.requirePermission('settings');
    if (!apiKey) throw new Error('API key required');
    const resolvedBaseUrl = await resolveBaseUrl(ctx, provider, baseUrl);
    await testConnection({ provider, apiKey, baseUrl: resolvedBaseUrl });
    return { success: true };
  }));

  app.post('/api/list-provider-models', authed(async (ctx, { provider = 'openai', apiKey = null, baseUrl = null } = {}) => {
    ctx.requirePermission('settings');
    const raw = await getSetting({ userId: ctx.user.id, key: `user_settings_${ctx.user.id}` });
    const settings = raw ? safeParse(raw) : {};
    let resolvedKey = apiKey || null;
    if (!resolvedKey) {
      const keys = Array.isArray(settings.apiKeys) ? settings.apiKeys : [];
      const providerKeys = keys.filter((item) => (item.provider || 'openai') === provider);
      const active = providerKeys.find((item) => item.isActive) || providerKeys[0];
      resolvedKey = active?.key || null;
      if (!resolvedKey && provider === 'openai') {
        resolvedKey = await getSetting({ userId: ctx.user.id, key: `api_key_${ctx.user.id}` });
      }
    }
    if (!resolvedKey) throw new Error(`No API key configured for ${provider}`);
    const resolvedBaseUrl = baseUrl ? String(baseUrl).trim() : customBaseUrl(settings.customProviders, provider);
    const models = await listProviderModels({ provider, apiKey: resolvedKey, baseUrl: resolvedBaseUrl });
    return { success: true, models };
  }));

  app.post('/api/scrape-website', authed(async (ctx, { url, platform = 'generic', mode = 'static' } = {}) => {
    ctx.requireAnyPermission(['scraper', 'generate']);
    const products = await ProductScraper.productScrapper(url, { platform, mode });
    await logActivity({ userId: ctx.user.id, action: 'scraper.run', details: `Scraped ${products.length} products from ${url}` });
    return { success: true, products };
  }));

  app.post('/api/save-product-database', authed(async (ctx, { products } = {}) => {
    ctx.requireAnyPermission(['scraper', 'generate']);
    const ownerId = await ctx.getWorkspaceOwnerId();
    const list = Array.isArray(products) ? products : [];
    await setSetting({ userId: ownerId, key: `product_database_${ownerId}`, value: JSON.stringify(list) });
    await logActivity({ userId: ctx.user.id, action: 'scraper.save', details: `Saved ${list.length} products to database` });
    return { success: true, paths: { database: `settings:product_database_${ownerId}` } };
  }));

  app.post('/api/get-product-database', authed(async (ctx) => {
    ctx.requireAnyPermission(['scraper', 'generate']);
    const ownerId = await ctx.getWorkspaceOwnerId();
    const raw = await getSetting({ userId: ownerId, key: `product_database_${ownerId}` });
    const products = raw ? safeParseArray(raw) : [];
    return { success: true, products };
  }));

  app.post('/api/preview-link', authed(async (ctx, { url } = {}) => {
    ctx.requirePermission('generate');
    const raw = String(url || '').trim();
    if (!raw) throw new Error('URL is required');
    if (!/^https?:\/\//i.test(raw)) throw new Error('URL must start with http:// or https://');

    const userRaw = await getSetting({ userId: ctx.user.id, key: `user_settings_${ctx.user.id}` });
    const userSettings = userRaw ? safeParse(userRaw) : {};
    const configuredEndpoint = String(userSettings.linkPreviewEndpoint || process.env.LINKPREVIEW_ENDPOINT || 'https://api.linkpreview.net').trim();
    const linkPreviewApiKey = String(userSettings.linkPreviewApiKey || process.env.LINKPREVIEW_API_KEY || '').trim();
    const linkPreviewEndpoint = normalizeLinkPreviewEndpoint(configuredEndpoint);

    const buildFallbackPreview = async () => {
      const response = await axios.get(raw, {
        timeout: 15000,
        maxRedirects: 5,
        headers: { ...UA_HEADERS, Accept: 'text/html,application/xhtml+xml' },
        responseType: 'text',
      });
      const finalUrl = response?.request?.res?.responseUrl || raw;
      const $ = cheerio.load(response.data || '');
      const firstNonEmpty = (...vals) => vals.find((v) => typeof v === 'string' && v.trim())?.trim() || '';
      const absolutize = (candidate) => {
        if (!candidate) return '';
        try {
          return new URL(candidate, finalUrl).toString();
        } catch {
          return '';
        }
      };
      const title = firstNonEmpty($('meta[property="og:title"]').attr('content'), $('meta[name="twitter:title"]').attr('content'), $('title').first().text());
      const description = firstNonEmpty($('meta[property="og:description"]').attr('content'), $('meta[name="description"]').attr('content'), $('meta[name="twitter:description"]').attr('content'));
      const image = absolutize(firstNonEmpty($('meta[property="og:image"]').attr('content'), $('meta[name="twitter:image"]').attr('content')));
      const siteName = firstNonEmpty($('meta[property="og:site_name"]').attr('content'), new URL(finalUrl).hostname);
      const favicon = absolutize(firstNonEmpty($('link[rel="icon"]').attr('href'), $('link[rel="shortcut icon"]').attr('href'), '/favicon.ico'));
      return { url: finalUrl, title: title || finalUrl, description, image, siteName, favicon };
    };

    if (linkPreviewApiKey && /^https?:\/\//i.test(linkPreviewEndpoint)) {
      try {
        const lpRes = await axios.get(linkPreviewEndpoint, {
          timeout: 15000,
          headers: { ...UA_HEADERS, 'X-Linkpreview-Api-Key': linkPreviewApiKey },
          params: { q: raw, key: linkPreviewApiKey, fields: 'icon,icon_type' },
        });
        const data = lpRes.data || {};
        const hasStructuredData = typeof data === 'object' && !Array.isArray(data) && (data.title || data.description || data.image || data.url);
        if (!hasStructuredData) throw new Error('LinkPreview returned an unexpected payload');
        const resolvedUrl = String(data.url || raw);
        return {
          success: true,
          preview: {
            url: resolvedUrl,
            title: String(data.title || resolvedUrl),
            description: String(data.description || ''),
            image: String(data.image || ''),
            siteName: new URL(resolvedUrl).hostname,
            favicon: String(data.icon || ''),
          },
        };
      } catch {
        /* fall through to local extraction */
      }
    }

    const fallbackPreview = await buildFallbackPreview();
    return { success: true, preview: fallbackPreview };
  }));
}

function normalizeLinkPreviewEndpoint(endpoint) {
  try {
    const parsed = new URL(endpoint || 'https://api.linkpreview.net');
    const host = parsed.hostname.toLowerCase();
    if (host === 'my.linkpreview.net' || host === 'linkpreview.net' || host === 'www.linkpreview.net') {
      return 'https://api.linkpreview.net';
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return 'https://api.linkpreview.net';
  }
}

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function safeParseArray(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
