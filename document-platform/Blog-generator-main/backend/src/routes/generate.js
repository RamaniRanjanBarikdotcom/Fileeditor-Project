// Generation channels — generate-blog & generate-blog-image.
// The HTTP response carries the final result (like the IPC invoke return); step
// progress streams over the user's WebSocket as `generation-progress` events.
import { authed } from './_util.js';
import { getSetting, getBlogById, recoverGenParamsFromLogs } from '../db/actions.js';
import { emitToUser } from '../realtime/ws.js';
import { generateBlog, generateBlogImage } from '../services/blogGenerator.js';
import { uploadImageToStorage } from '../services/publishService.js';

/** Build the merged settings + a provider-key resolver, shared by both handlers. */
async function buildGenContext(ctx, settings, defaults) {
  const raw = await getSetting({ userId: ctx.user.id, key: `user_settings_${ctx.user.id}` });
  const storedSettings = raw ? safeParse(raw) : {};
  const mergedSettings = { ...defaults, ...storedSettings, ...(settings || {}) };

  const getProviderApiKey = async (providerId) => {
    let key = null;
    if (Array.isArray(mergedSettings.apiKeys)) {
      const providerKeys = mergedSettings.apiKeys.filter((item) => (item.provider || 'openai') === providerId);
      const active = providerKeys.find((item) => item.isActive) || providerKeys[0];
      if (active?.key) key = active.key;
    }
    if (!key && providerId === 'openai') {
      key = await getSetting({ userId: ctx.user.id, key: `api_key_${ctx.user.id}` });
    }
    return key;
  };

  return { storedSettings, mergedSettings, getProviderApiKey };
}

export default async function generateRoutes(app) {
  app.post('/api/generate-blog', authed(async (ctx, body = {}) => {
    const { topic, keywords, categories = [], settings, resumeState = null, __schedulerJobId = '', regenerateBlogId = '' } = body;
    if (__schedulerJobId) ctx.requireAnyPermission(['generate', 'scheduler']);
    else ctx.requirePermission('generate');

    const ownerId = await ctx.getWorkspaceOwnerId();
    const isAdmin = ctx.isAdmin();

    // For "Generate again", the backend is the source of truth for the inputs: reuse the
    // blog's saved generation settings (topic/keywords/style/tone/length/focus/product
    // context). If the blog predates gen_params, recover them from the generation logs.
    // generateBlog then re-saves gen_params, so subsequent regenerations are instant.
    let effTopic = topic;
    let effKeywords = keywords;
    let effSettings = settings || {};
    if (regenerateBlogId) {
      const existing = await getBlogById(regenerateBlogId, { userId: ownerId, isAdmin });
      if (existing) {
        let gp =
          existing.genParams && typeof existing.genParams === 'object' && Object.keys(existing.genParams).length
            ? existing.genParams
            : null;
        if (!gp) gp = (await recoverGenParamsFromLogs(regenerateBlogId, { userId: ownerId, isAdmin }).catch(() => null)) || {};
        effTopic = existing.topic || existing.title || topic;
        const hasKw = gp.keywords && (Array.isArray(gp.keywords) ? gp.keywords.length : String(gp.keywords).trim());
        effKeywords = hasKw ? gp.keywords : existing.keywords || keywords;
        effSettings = { ...(settings || {}) };
        if (gp.writingStyle) effSettings.writingStyle = gp.writingStyle;
        if (gp.writingTone) effSettings.writingTone = gp.writingTone;
        if (gp.targetWordCount) effSettings.targetWordCount = gp.targetWordCount;
        if (gp.focusKeyword) effSettings.focusKeyword = gp.focusKeyword;
        if (typeof gp.useProductContext === 'boolean') effSettings.useProductContext = gp.useProductContext;
        if (gp.language) effSettings.language = gp.language;
        if (gp.websiteUrl) effSettings.websiteUrl = gp.websiteUrl;
        if (gp.scraperPlatform) effSettings.scraperPlatform = gp.scraperPlatform;
      }
    }

    const { mergedSettings, getProviderApiKey } = await buildGenContext(ctx, effSettings, {
      aiProvider: 'openai',
      imageProvider: 'openai',
      aiModel: 'gpt-4o',
      imageModel: 'gpt-image-1',
      maxTokens: null,
      serpProvider: 'openai',
      deepResearchProvider: 'openai',
      deepResearchModel: 'gpt-4o-mini',
      autoSave: true,
    });

    const products = mergedSettings.useProductContext ? await loadProducts(ownerId) : [];
    const destinationUrl = resolveDestinationUrl(mergedSettings, effSettings?.destinationId || mergedSettings.destinationId);

    return generateBlog({
      topic: effTopic,
      keywords: effKeywords,
      categories,
      settings: effSettings,
      resumeState,
      mergedSettings,
      user: ctx.user,
      ownerId,
      products,
      destinationUrl,
      isAdmin,
      regenerateBlogId,
      getProviderApiKey,
      onProgress: (step, message) => emitToUser(ctx.user.id, 'generation-progress', { step, message }),
    });
  }));

  app.post('/api/generate-blog-image', authed(async (ctx, body = {}) => {
    const { blogId, title, content, __schedulerJobId = '' } = body;
    if (__schedulerJobId) ctx.requireAnyPermission(['history', 'scheduler']);
    else ctx.requirePermission('history');

    const { storedSettings, mergedSettings, getProviderApiKey } = await buildGenContext(ctx, null, {
      aiProvider: 'openai',
      imageProvider: 'openai',
      imageModel: 'gpt-image-1',
    });

    const ownerId = await ctx.getWorkspaceOwnerId();
    return generateBlogImage({
      blogId,
      title,
      content,
      mergedSettings,
      storedSettings,
      user: ctx.user,
      ownerId,
      isAdmin: ctx.isAdmin(),
      getProviderApiKey,
      uploadStorage: uploadImageToStorage,
    });
  }));
}

/** Resolve a publish destination's public site URL (for brand/site context). */
function resolveDestinationUrl(settings, destinationId) {
  if (!destinationId) return '';
  const list = Array.isArray(settings?.publishDestinations) ? settings.publishDestinations : [];
  const dest = list.find((item) => item.id === destinationId);
  if (!dest) return '';
  if (dest.platform === 'shopify' && dest.shopDomain) {
    return `https://${String(dest.shopDomain).replace(/^https?:\/\//, '')}`;
  }
  return dest.baseUrl || '';
}

/** Product context is stored per workspace owner in the settings collection. */
export async function loadProducts(ownerId) {
  const raw = await getSetting({ userId: ownerId, key: `product_database_${ownerId}` });
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
