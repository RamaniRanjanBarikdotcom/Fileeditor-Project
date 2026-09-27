// Logs / activities / notifications / api-usage channels.
import { authed } from './_util.js';
import {
  listLogs,
  listActivities,
  listUsers,
  getLogStats,
  getLogTrend,
  clearLogs,
  listNotifications,
  markNotificationRead,
  clearNotifications,
  getApiUsage,
  logActivity,
} from '../db/actions.js';

// Cache the username map briefly — users change rarely, but get-logs was reloading ALL
// users on every fetch (an extra round-trip to Atlas each time the Logs page loads).
let _userMapCache = { ts: 0, map: new Map() };
async function getCachedUsernameMap() {
  const nowMs = Date.now();
  if (_userMapCache.map.size && nowMs - _userMapCache.ts < 60000) return _userMapCache.map;
  try {
    const users = await listUsers();
    _userMapCache = {
      ts: nowMs,
      map: new Map((Array.isArray(users) ? users : []).map((u) => [String(u?.id || ''), String(u?.username || '')])),
    };
  } catch {
    /* keep the previous cache on failure */
  }
  return _userMapCache.map;
}

function actionToCategory(action) {
  const prefix = String(action || '').split('.')[0];
  if (!prefix) return 'activity';
  if (prefix === 'blog') return 'history';
  if (prefix === 'auth') return 'auth';
  if (prefix === 'user' || prefix === 'users') return 'admin';
  if (prefix === 'logs') return 'logs';
  if (prefix === 'notification' || prefix === 'notifications') return 'notifications';
  return prefix;
}

export default async function logsRoutes(app) {
  app.post('/api/get-activities', authed(async (ctx) => {
    ctx.requirePermission('notifications');
    const activities = await listActivities({ userId: ctx.user.id, isAdmin: ctx.isAdmin(), limit: 50 });
    return { success: true, activities };
  }));

  app.post('/api/get-logs', authed(async (ctx, body = {}) => {
    ctx.requireAnyPermission(['logs', 'notifications']);
    const {
      limit = 100,
      offset = 0,
      level = null,
      category = null,
      dateFrom = null,
      dateTo = null,
      search = null,
      includeActivities = true,
    } = body;
    const isAdmin = ctx.isAdmin();
    const workspaceOwnerId = await ctx.getWorkspaceOwnerId();
    const scopedUserId = isAdmin ? ctx.user.id : workspaceOwnerId;

    const safeLimitRaw = Number(limit);
    const safeOffsetRaw = Number(offset);
    const safeLimit = Number.isFinite(safeLimitRaw) ? Math.max(1, Math.min(Math.round(safeLimitRaw), 20000)) : 100;
    const safeOffset = Number.isFinite(safeOffsetRaw) ? Math.max(0, Math.round(safeOffsetRaw)) : 0;
    // Fetching `safeLimit` from each source is enough to produce the top `safeLimit` after
    // merge (no need to over-fetch 2x). Server-side filters are already applied below.
    const mergedFetchLimit = includeActivities
      ? Math.min(Math.max(safeLimit, 200), 20000)
      : Math.min(20000, safeLimit + safeOffset);

    const logs = await listLogs({
      userId: scopedUserId,
      isAdmin,
      limit: mergedFetchLimit,
      offset: 0,
      level,
      category,
      dateFrom,
      dateTo,
      search,
    });
    let merged = Array.isArray(logs) ? [...logs] : [];

    if (includeActivities) {
      try {
        const activities = await listActivities({ userId: scopedUserId, isAdmin, limit: mergedFetchLimit, offset: 0, skipUserMap: true });
        const activityLogs = (Array.isArray(activities) ? activities : [])
          .map((activity) => ({
            id: `activity-${activity?.id || Math.random().toString(16).slice(2)}`,
            timestamp: activity?.createdAt || activity?.created_at || null,
            level: 'info',
            category: actionToCategory(activity?.action),
            message: activity?.details || activity?.action || 'Activity',
            details: JSON.stringify({ source: 'activity', action: activity?.action || null, username: activity?.username || null }),
            blogId: null,
            tokensUsed: undefined,
            cost: undefined,
            userId: activity?.userId || activity?.user_id || scopedUserId,
            username: activity?.username || null,
          }))
          .filter((entry) => {
            if (level && String(level).trim() && entry.level !== level) return false;
            if (category && String(category).trim() && entry.category !== category) return false;
            return true;
          });
        merged = merged.concat(activityLogs);
      } catch {
        /* best-effort merge */
      }

      try {
        const usernameById = await getCachedUsernameMap();
        merged = merged.map((entry) => {
          const entryUserId = String(entry?.userId || '');
          const mappedName =
            String(entry?.username || '').trim() ||
            (entryUserId ? String(usernameById.get(entryUserId) || '').trim() : '') ||
            (entryUserId === String(ctx.user.id) ? String(ctx.user.username || '') : '');
          return { ...entry, username: mappedName || null };
        });
      } catch {
        /* best-effort user mapping */
      }

      merged.sort((a, b) => {
        const aTime = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });
    }

    const dateFromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const dateToMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const searchText = String(search || '').trim().toLowerCase();
    const levelFilter = String(level || '').trim().toLowerCase();
    const categoryFilter = String(category || '').trim().toLowerCase();

    merged = merged.filter((entry) => {
      const entryLevel = String(entry?.level || '').toLowerCase();
      const entryCategory = String(entry?.category || '').toLowerCase();
      if (levelFilter && entryLevel !== levelFilter) return false;
      if (categoryFilter && entryCategory !== categoryFilter) return false;
      if (searchText) {
        const haystack = [entry?.message || '', entry?.details || '', entry?.category || '', entry?.blogId || '', entry?.username || '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchText)) return false;
      }
      if (dateFromMs !== null || dateToMs !== null) {
        const ts = entry?.timestamp ? new Date(entry.timestamp).getTime() : NaN;
        if (Number.isNaN(ts)) return false;
        if (dateFromMs !== null && ts < dateFromMs) return false;
        if (dateToMs !== null && ts > dateToMs) return false;
      }
      return true;
    });

    merged = merged.slice(safeOffset, safeOffset + safeLimit);
    return { success: true, logs: merged };
  }));

  app.post('/api/get-logs-stats', authed(async (ctx, { dateFrom = null, dateTo = null, search = null, level = null, category = null } = {}) => {
    ctx.requireAnyPermission(['logs', 'notifications']);
    const isAdmin = ctx.isAdmin();
    const scopedUserId = isAdmin ? ctx.user.id : await ctx.getWorkspaceOwnerId();
    const stats = await getLogStats({ userId: scopedUserId, isAdmin, dateFrom, dateTo, search, level, category });
    return { success: true, stats };
  }));

  app.post('/api/get-logs-trend', authed(async (ctx, { dateFrom = null, dateTo = null, search = null, category = null } = {}) => {
    ctx.requireAnyPermission(['logs', 'notifications']);
    const isAdmin = ctx.isAdmin();
    const scopedUserId = isAdmin ? ctx.user.id : await ctx.getWorkspaceOwnerId();
    const trend = await getLogTrend({ userId: scopedUserId, isAdmin, dateFrom, dateTo, search, category });
    return { success: true, trend };
  }));

  app.post('/api/clear-logs', authed(async (ctx) => {
    ctx.requireAnyPermission(['logs', 'notifications']);
    ctx.requirePermission('delete.logs');
    const isAdmin = ctx.isAdmin();
    const scopedUserId = isAdmin ? ctx.user.id : await ctx.getWorkspaceOwnerId();
    await clearLogs({ userId: scopedUserId, isAdmin });
    await logActivity({ userId: ctx.user.id, action: 'logs.clear', details: 'Cleared logs' });
    return { success: true };
  }));

  app.post('/api/get-notifications', authed(async (ctx) => {
    ctx.requirePermission('notifications');
    const notifications = await listNotifications({ userId: ctx.user.id, isAdmin: ctx.isAdmin(), limit: 100 });
    return { success: true, notifications };
  }));

  app.post('/api/mark-notification-read', authed(async (ctx, { id } = {}) => {
    ctx.requirePermission('notifications');
    await markNotificationRead({ id, userId: ctx.user.id, isAdmin: ctx.isAdmin() });
    return { success: true };
  }));

  app.post('/api/clear-notifications', authed(async (ctx) => {
    ctx.requirePermission('notifications');
    await clearNotifications({ userId: ctx.user.id, isAdmin: ctx.isAdmin() });
    return { success: true };
  }));

  app.post('/api/get-api-usage', authed(async (ctx) => {
    const isAdmin = ctx.isAdmin();
    const usage = await getApiUsage({ userId: isAdmin ? ctx.user.id : await ctx.getWorkspaceOwnerId(), isAdmin });
    return { success: true, usage };
  }));
}
