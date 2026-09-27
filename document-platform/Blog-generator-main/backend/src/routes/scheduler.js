// Scheduler channels — CRUD + logs + history-blog picker. Jobs are scoped to the
// workspace owner so all members of a workspace share the schedule (matches PHP).
import { authed } from './_util.js';
import { listBlogs, addLog as addAppLog } from '../db/actions.js';
import {
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  importCsv,
  listLogs,
  addLog,
} from '../services/schedulerService.js';
import { publishSchedulerEvent } from '../realtime/pubsub.js';

async function appLog(ctx, level, message, details) {
  try {
    await addAppLog({ level, category: 'scheduler', message, details: details || null, userId: ctx.user.id });
  } catch {
    /* ignore */
  }
}

export default async function schedulerRoutes(app) {
  app.post('/api/scheduler-list-jobs', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    const jobs = await listJobs(scope, { status: payload.status || '', shopId: payload.shopId || '', limit: payload.limit || 500 });
    return { success: true, jobs };
  }));

  app.post('/api/scheduler-list-history-blogs', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    const limitRaw = Number(payload?.limit || 1000);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.round(limitRaw))) : 1000;
    const search = String(payload?.search || '').trim();
    const items = await listBlogs({ limit, userId: scope, isAdmin: ctx.isAdmin(), search, lean: true });
    const blogs = (Array.isArray(items) ? items : [])
      .map((item) => ({
        id: String(item?.id || item?._id || ''),
        title: String(item?.title || item?.topic || '').trim(),
        keywords: item?.keywords || '',
        categories: Array.isArray(item?.categories) ? item.categories : String(item?.categories || '').split(',').map((x) => x.trim()).filter(Boolean),
        generatedAt: item?.generatedAt || item?.created_at || item?.createdAt || '',
      }))
      .filter((item) => item.id && item.title);
    return { success: true, blogs };
  }));

  app.post('/api/scheduler-create-job', authed(async (ctx, { job } = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    try {
      const created = await createJob(scope, job || {});
      publishSchedulerEvent({ userId: scope, jobId: created?.id, action: 'create' });
      await appLog(ctx, 'info', `Schedule created${created?.topic ? `: "${created.topic}"` : ''}`, { action: 'scheduler.create', jobId: created?.id });
      return { success: true, job: created };
    } catch (error) {
      await appLog(ctx, 'error', 'Failed to create schedule', { action: 'scheduler.create', error: error.message });
      return { success: false, error: error.message };
    }
  }));

  app.post('/api/scheduler-update-job', authed(async (ctx, { jobId, updates } = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    try {
      const job = await updateJob(scope, String(jobId || ''), updates || {});
      const nextStatus = String(updates?.status || job?.status || '').trim();
      publishSchedulerEvent({ userId: scope, jobId: String(jobId || ''), status: nextStatus, action: 'update' });
      const msg = nextStatus === 'paused' ? 'Schedule paused' : nextStatus === 'pending' ? 'Schedule resumed' : 'Schedule updated';
      await appLog(ctx, 'info', msg, { action: 'scheduler.update', jobId: String(jobId || ''), status: nextStatus });
      return { success: true, job };
    } catch (error) {
      await appLog(ctx, 'error', 'Failed to update schedule', { action: 'scheduler.update', jobId: String(jobId || ''), error: error.message });
      return { success: false, error: error.message };
    }
  }));

  app.post('/api/scheduler-delete-job', authed(async (ctx, { jobId } = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    try {
      const deleted = await deleteJob(scope, String(jobId || ''));
      publishSchedulerEvent({ userId: scope, jobId: String(jobId || ''), action: 'delete' });
      await appLog(ctx, 'warning', 'Schedule deleted', { action: 'scheduler.delete', jobId: String(jobId || ''), deleted });
      return { success: true, deleted };
    } catch (error) {
      await appLog(ctx, 'error', 'Failed to delete schedule', { action: 'scheduler.delete', jobId: String(jobId || ''), error: error.message });
      return { success: false, error: error.message };
    }
  }));

  app.post('/api/scheduler-import-csv', authed(async (ctx, { csvContent, defaultShopId = '' } = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    try {
      const { created, errors } = await importCsv(scope, csvContent, defaultShopId);
      if (created) publishSchedulerEvent({ userId: scope, action: 'import' });
      await appLog(ctx, errors.length ? 'warning' : 'info', 'Scheduler CSV import completed', { action: 'scheduler.importCsv', created, errors: errors.slice(0, 30) });
      return { success: true, created, errors };
    } catch (error) {
      await appLog(ctx, 'error', 'Scheduler CSV import failed', { action: 'scheduler.importCsv', error: error.message });
      return { success: false, error: error.message };
    }
  }));

  app.post('/api/scheduler-list-logs', authed(async (ctx, payload = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    const logs = await listLogs(scope, { jobId: payload.jobId || '', status: payload.status || '', limit: payload.limit || 500 });
    return { success: true, logs };
  }));

  app.post('/api/scheduler-add-log', authed(async (ctx, { log } = {}) => {
    ctx.requirePermission('scheduler');
    const scope = await ctx.getWorkspaceOwnerId();
    const id = await addLog(scope, log || {});
    return { success: true, id };
  }));
}
