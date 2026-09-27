// History / blogs channels — ports of the history ipcMain handlers.
// (WordPress status counts are deferred to Phase 4; wpCounts is returned null.)
import { authed } from './_util.js';
import {
  listBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  clearBlogs,
  getHistorySummary,
  logActivity,
} from '../db/actions.js';

export default async function historyRoutes(app) {
  app.post('/api/get-history', authed(async (ctx, { userId, limit } = {}) => {
    ctx.requirePermission('history');
    const isAdmin = ctx.isAdmin();
    const workspaceOwnerId = await ctx.getWorkspaceOwnerId();
    const targetUserId = isAdmin ? (userId || null) : workspaceOwnerId;
    const requestedLimitRaw = Number(limit);
    const requestedLimit = Number.isFinite(requestedLimitRaw)
      ? Math.max(1, Math.min(10000, Math.round(requestedLimitRaw)))
      : 5000;

    // Run the list and the summary in parallel — they hit different paths and don't depend
    // on each other. `minimal` returns only the columns the list/CSV need (smallest payload).
    const listArgs = isAdmin
      ? { limit: requestedLimit, userId: targetUserId, isAdmin: true, minimal: true }
      : { limit: requestedLimit, userId: null, isAdmin: false, minimal: true };
    const [history, summaryResult] = await Promise.all([
      listBlogs(listArgs),
      getHistorySummary({ userId: isAdmin ? targetUserId : null, isAdmin }).catch(() => null),
    ]);
    const summary = summaryResult || { totalCount: history.length, totalCost: 0 };
    const adjustedSummary =
      summary && typeof summary === 'object'
        ? { ...summary, totalCount: Math.max(Number(summary.totalCount || 0), history.length) }
        : summary;

    return { success: true, history, summary: adjustedSummary, wpCounts: null };
  }));

  app.post('/api/get-blog', authed(async (ctx, { id } = {}) => {
    ctx.requirePermission('history');
    const workspaceOwnerId = await ctx.getWorkspaceOwnerId();
    const blog = await getBlogById(id, { userId: workspaceOwnerId, isAdmin: ctx.isAdmin() });
    if (!blog) return { success: false, error: 'Blog not found' };
    return { success: true, blog };
  }));

  app.post('/api/update-blog', authed(async (ctx, { blog } = {}) => {
    ctx.requirePermission('history');
    const workspaceOwnerId = await ctx.getWorkspaceOwnerId();
    await updateBlog({ blog, userId: workspaceOwnerId, isAdmin: ctx.isAdmin() });
    await logActivity({ userId: ctx.user.id, action: 'blog.update', details: `Updated blog ${blog?.id}` });
    return { success: true };
  }));

  app.post('/api/delete-blog', authed(async (ctx, { id } = {}) => {
    ctx.requirePermission('history');
    ctx.requirePermission('delete.history');
    const workspaceOwnerId = await ctx.getWorkspaceOwnerId();
    await deleteBlog({ id, userId: workspaceOwnerId, isAdmin: ctx.isAdmin() });
    await logActivity({ userId: ctx.user.id, action: 'blog.delete', details: `Deleted blog ${id}` });
    return { success: true };
  }));

  app.post('/api/clear-blogs', authed(async (ctx) => {
    ctx.requirePermission('history');
    ctx.requirePermission('delete.history');
    const workspaceOwnerId = await ctx.getWorkspaceOwnerId();
    await clearBlogs({ userId: workspaceOwnerId, isAdmin: ctx.isAdmin() });
    await logActivity({ userId: ctx.user.id, action: 'blog.clear', details: 'Cleared all blogs' });
    return { success: true };
  }));
}
