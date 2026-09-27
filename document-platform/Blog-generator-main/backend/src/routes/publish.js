// Publishing channels — publish-blog, test-publish-destination, image storage,
// and WordPress category management.
import { authed } from './_util.js';
import { getSetting, getBlogById, updateBlog, recordPublishHistory, logActivity } from '../db/actions.js';
import { getPublishDestination } from '../lib/context.js';
import { getAccessToken as getShopifyAccessToken } from '../services/shopifyOauth.js';
import {
  publishBlog,
  testPublishDestination,
  uploadImageToStorage,
  fetchWordpressCategories,
  createWordpressCategoryRemote,
  extractPublishError,
} from '../services/publishService.js';

async function userSettings(ctx) {
  const raw = await getSetting({ userId: ctx.user.id, key: `user_settings_${ctx.user.id}` });
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export default async function publishRoutes(app) {
  app.post('/api/publish-blog', authed(async (ctx, body = {}) => {
    const { destination, blog, status = 'draft', __schedulerJobId = '' } = body;
    if (__schedulerJobId) ctx.requireAnyPermission(['export', 'scheduler']);
    else ctx.requirePermission('export');
    if (!destination || typeof destination !== 'object') throw new Error('Publish destination is required');
    if (!blog) throw new Error('Blog content is required');

    const settings = await userSettings(ctx);
    const ownerId = await ctx.getWorkspaceOwnerId();
    const isAdmin = ctx.isAdmin();

    // Server-side Shopify: resolve the stored access token from the OAuth connection
    // when the destination doesn't carry one (the secret never reaches the client).
    let resolvedDestination = destination;
    if (destination.platform === 'shopify' && !destination.accessToken && destination.shopDomain) {
      try {
        const accessToken = await getShopifyAccessToken(ctx.user.id, destination.shopDomain, destination.id || '');
        resolvedDestination = { ...destination, accessToken };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    try {
      const { result, platform, publishStatus, remotePostId, publishedUrl } = await publishBlog({
        destination: resolvedDestination,
        blog,
        status,
        userSettings: settings,
        getLatestBlog: (id) => getBlogById(id, { userId: ownerId, isAdmin }),
      });

      await recordPublishHistory({
        blogId: blog.id || null,
        remotePostId,
        destinationId: destination.id || null,
        destinationName: destination.name || platform,
        platform,
        status: publishStatus,
        publishedUrl,
        userId: ownerId || ctx.user.id,
      });
      await logActivity({
        userId: ctx.user.id,
        action: publishStatus === 'publish' ? 'publish.live' : 'publish.draft',
        details: `Published to ${destination.name || platform} (${publishStatus})`,
      });

      return { success: true, result };
    } catch (error) {
      return { success: false, error: extractPublishError(error) };
    }
  }));

  app.post('/api/test-publish-destination', authed(async (ctx, { destination } = {}) => {
    ctx.requirePermission('settings');
    if (!destination || typeof destination !== 'object') throw new Error('Destination is required');
    let target = destination;
    if (destination.platform === 'shopify' && !destination.accessToken && destination.shopDomain) {
      try {
        const accessToken = await getShopifyAccessToken(ctx.user.id, destination.shopDomain, destination.id || '');
        target = { ...destination, accessToken };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    try {
      const result = await testPublishDestination(target);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: extractPublishError(error) };
    }
  }));

  app.post('/api/upload-image-storage', authed(async (ctx, { blogId = null, title = '', imageUrl = '', localImagePath = '' } = {}) => {
    ctx.requireAnyPermission(['history', 'posts', 'generate']);
    const settings = await userSettings(ctx);
    if (!settings.imageStorage?.enabled) return { success: false, skipped: true, error: 'Image storage not enabled' };

    const ownerId = await ctx.getWorkspaceOwnerId();
    const isAdmin = ctx.isAdmin();
    let blog = null;
    if (blogId) blog = await getBlogById(blogId, { userId: ownerId, isAdmin });

    const uploadedUrl = await uploadImageToStorage({
      blog: blog || { id: blogId, title },
      imageUrl,
      localImagePath,
      storage: settings.imageStorage,
      filenameBase: title || blog?.title || 'blog-image',
    });
    if (!uploadedUrl) throw new Error('Image storage did not return a URL.');

    if (blogId && blog) {
      await updateBlog({ blog: { ...blog, imageUrl: uploadedUrl, localImagePath: '' }, userId: ownerId, isAdmin });
    }
    return { success: true, url: uploadedUrl };
  }));

  app.post('/api/test-image-storage', authed(async (ctx, { imageStorage } = {}) => {
    ctx.requirePermission('settings');
    const storage = imageStorage || {};
    if (!storage.enabled) throw new Error('Image storage not enabled');
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const url = await uploadImageToStorage({ blog: { title: 'storage-test' }, imageUrl: tinyPng, localImagePath: '', storage, filenameBase: 'storage-test' });
    return { success: true, url };
  }));

  app.post('/api/list-wordpress-categories', authed(async (ctx, { destinationId = null } = {}) => {
    ctx.requirePermission('export');
    const destination = await getPublishDestination(destinationId, ctx.user.id);
    if (!destination || !['wordpress', 'wordpress-token'].includes(destination.platform)) {
      throw new Error('Select a WordPress destination to load categories');
    }
    try {
      const categories = await fetchWordpressCategories(destination);
      return { success: true, categories };
    } catch (error) {
      return { success: false, error: extractPublishError(error) };
    }
  }));

  app.post('/api/create-wordpress-category', authed(async (ctx, { destinationId = null, name } = {}) => {
    ctx.requirePermission('export');
    const cleaned = (name || '').trim();
    if (!cleaned) throw new Error('Category name is required');
    const destination = await getPublishDestination(destinationId, ctx.user.id);
    if (!destination || !['wordpress', 'wordpress-token'].includes(destination.platform)) {
      throw new Error('Select a WordPress destination to create categories');
    }
    try {
      const created = await createWordpressCategoryRemote(destination, cleaned);
      const categories = await fetchWordpressCategories(destination);
      return { success: true, category: created, categories };
    } catch (error) {
      return { success: false, error: extractPublishError(error) };
    }
  }));
}
