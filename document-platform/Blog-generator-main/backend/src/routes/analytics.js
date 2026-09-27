// Publish history / analytics / remote-post reads / session+event tracking.
// (Live WordPress sync and remote-post detail fetching are deferred to Phase 4;
// these read-only channels serve what is already stored in MongoDB.)
import { authed } from './_util.js';
import {
  listRemotePosts,
  getRemotePostAnalytics,
  getPublishHistory,
  getPublishHistoryByBlog,
  getPublishStatusMap,
  getPublishAnalytics,
  upsertSession,
  heartbeatSession,
  endSession,
  logAnalyticsEvent,
  getRealtimeAnalytics,
} from '../db/actions.js';

export default async function analyticsRoutes(app) {
  app.post('/api/get-remote-posts', authed(async (ctx, { status = null, limit = 200, destinationId = null } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    const posts = await listRemotePosts({ status, limit, destinationId });
    return { success: true, posts };
  }));

  app.post('/api/get-remote-post-analytics', authed(async (ctx) => {
    ctx.requireAnyPermission(['posts', 'history']);
    const analytics = await getRemotePostAnalytics();
    return { success: true, analytics };
  }));

  app.post('/api/get-publish-history', authed(async (ctx, { limit = 100, offset = 0, dateFrom, dateTo, platform, status, destinationId = null } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    const userId = ctx.isAdmin() ? null : await ctx.getWorkspaceOwnerId();
    const history = await getPublishHistory({ userId, limit, offset, dateFrom, dateTo, platform, status, destinationId });
    return { success: true, history };
  }));

  app.post('/api/get-blog-publish-status', authed(async (ctx, { blogId } = {}) => {
    ctx.requirePermission('history');
    if (!blogId) throw new Error('Blog ID is required');
    const history = await getPublishHistoryByBlog(blogId);
    return { success: true, history, isPublished: history.length > 0 };
  }));

  // Batch: latest publish status for every blog in the workspace in one query, so the
  // History page doesn't fire one request per blog (the old N+1 that made tags slow).
  app.post('/api/get-blog-publish-statuses', authed(async (ctx) => {
    ctx.requirePermission('history');
    const userId = ctx.isAdmin() ? null : await ctx.getWorkspaceOwnerId();
    const statuses = await getPublishStatusMap({ userId });
    return { success: true, statuses };
  }));

  app.post('/api/get-publish-analytics', authed(async (ctx, { dateFrom, dateTo, destinationId = null } = {}) => {
    ctx.requireAnyPermission(['posts', 'history']);
    const userId = ctx.isAdmin() ? null : await ctx.getWorkspaceOwnerId();
    const analytics = await getPublishAnalytics({ userId, dateFrom, dateTo, destinationId });
    return { success: true, analytics };
  }));

  // ---- session + event tracking ----
  app.post('/api/start-session', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('history');
    await upsertSession(payload);
    return { success: true };
  }));

  app.post('/api/heartbeat-session', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('history');
    await heartbeatSession(payload);
    return { success: true };
  }));

  app.post('/api/end-session', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('history');
    await endSession(payload);
    return { success: true };
  }));

  app.post('/api/log-analytics-event', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('history');
    await logAnalyticsEvent(payload);
    return { success: true };
  }));

  app.post('/api/get-realtime-analytics', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('history');
    const data = await getRealtimeAnalytics(payload || {});
    return { success: true, data };
  }));
}
