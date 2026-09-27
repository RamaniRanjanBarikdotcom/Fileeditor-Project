// Remote-post sync channels: sync, detail, update, delete, WP stats, WP sync test.
import { authed } from './_util.js';
import { getPublishDestination } from '../lib/context.js';
import { extractPublishError } from '../services/publishService.js';
import { getAccessToken as getShopifyAccessToken } from '../services/shopifyOauth.js';
import {
  syncRemotePosts,
  getRemotePostDetail,
  updateRemotePost,
  deleteRemotePost,
  getWordpressStats,
  testWordpressSync,
} from '../services/remoteSync.js';

// For server-side Shopify destinations the access token lives in shopify_connections,
// not on the destination — resolve + inject it before calling the provider.
async function resolveDestination(ctx, destination) {
  if (destination?.platform === 'shopify' && !destination.accessToken && destination.shopDomain) {
    const accessToken = await getShopifyAccessToken(ctx.user.id, destination.shopDomain, destination.id || '');
    return { ...destination, accessToken };
  }
  return destination;
}

export default async function remoteRoutes(app) {
  app.post('/api/sync-remote-posts', authed(async (ctx, { destinationId = null, after = null } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    const dest = await getPublishDestination(destinationId, ctx.user.id);
    if (!dest) throw new Error('No destination found. Please select a WordPress or Shopify destination.');
    try {
      const { count } = await syncRemotePosts({ destination: await resolveDestination(ctx, dest), after });
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message || 'Sync failed' };
    }
  }));

  app.post('/api/get-remote-post-detail', authed(async (ctx, { destinationId, postId, resolveLinkedImages = false } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    if (!destinationId || !postId) throw new Error('Destination and post ID are required');
    const dest = await getPublishDestination(destinationId, ctx.user.id);
    if (!dest) throw new Error('Destination not found');
    const { post } = await getRemotePostDetail({ destination: await resolveDestination(ctx, dest), postId, resolveLinkedImages });
    return { success: true, post };
  }));

  app.post('/api/update-remote-post', authed(async (ctx, { destinationId, postId, title, content, status, imageUrl } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    if (!destinationId || !postId) throw new Error('Destination and post ID are required');
    const dest = await getPublishDestination(destinationId, ctx.user.id);
    if (!dest) throw new Error('Destination not found');
    const { postId: id } = await updateRemotePost({ destination: await resolveDestination(ctx, dest), postId, title, content, status, imageUrl });
    return { success: true, postId: id };
  }));

  app.post('/api/delete-remote-post', authed(async (ctx, { destinationId, postId, force = false } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    ctx.requirePermission('delete.posts');
    if (!destinationId || !postId) throw new Error('Destination and post ID are required');
    const dest = await getPublishDestination(destinationId, ctx.user.id);
    if (!dest) throw new Error('Destination not found');
    await deleteRemotePost({ destination: await resolveDestination(ctx, dest), postId, force });
    return { success: true };
  }));

  app.post('/api/get-wordpress-stats', authed(async (ctx, { destinationId = null } = {}) => {
    ctx.requirePermission('history');
    const dest = await getPublishDestination(destinationId, ctx.user.id);
    if (!dest || !['wordpress', 'wordpress-token'].includes(dest.platform)) throw new Error('Select a WordPress destination to load stats');
    try {
      const counts = await getWordpressStats(dest);
      return { success: true, counts };
    } catch (error) {
      return { success: false, error: extractPublishError(error) || error.message };
    }
  }));

  app.post('/api/test-wordpress-sync', authed(async (ctx, { destinationId = null } = {}) => {
    ctx.requirePermission('history');
    const dest = await getPublishDestination(destinationId, ctx.user.id);
    if (!dest) return { success: false, error: 'No destination found', destination: null };
    const { ok, error, result } = await testWordpressSync(dest);
    return ok ? { success: true, result } : { success: false, error: error || 'Connection test failed', result };
  }));
}
