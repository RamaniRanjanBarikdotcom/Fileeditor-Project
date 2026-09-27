// Scheduler data layer — ports the PHP /scheduler/* routes (scheduler_jobs,
// scheduler_logs collections) plus the desktop's job normalization + due-check used by
// the worker. Jobs are scoped to the workspace owner (user_id).

import { getDb, ObjectId } from '../db/mongo.js';
import { redactSensitive } from '../lib/redact.js';

const col = (name) => getDb().collection(name);

function parseObjectId(id) {
  const raw = String(id ?? '').trim();
  if (ObjectId.isValid(raw) && String(new ObjectId(raw)) === raw) return new ObjectId(raw);
  return raw;
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function schedulerParseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value || '').trim().toLowerCase();
  if (!text) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false;
  return fallback;
}

/** Map a raw scheduler_jobs doc to the JSON shape the renderer consumed from PHP. */
function mapJob(doc) {
  if (!doc) return null;
  const id = String(doc._id ?? '');
  return {
    id,
    _id: id,
    user_id: doc.user_id ?? null,
    shop_id: doc.shop_id ?? '',
    topic: doc.topic ?? '',
    keywords: doc.keywords ?? '',
    schedule_mode: doc.schedule_mode ?? 'generate',
    source_blog_id: doc.source_blog_id ?? '',
    payload: doc.payload && typeof doc.payload === 'object' ? doc.payload : {},
    run_at: doc.run_at ?? null,
    status: doc.status ?? 'pending',
    created_at: doc.created_at ?? null,
    updated_at: doc.updated_at ?? null,
    completed_at: doc.completed_at ?? null,
  };
}

function mapLog(doc) {
  const id = String(doc._id ?? '');
  return {
    id,
    _id: id,
    user_id: doc.user_id ?? null,
    job_id: doc.job_id ?? '',
    shop_id: doc.shop_id ?? '',
    status: doc.status ?? 'info',
    message: doc.message ?? '',
    published_url: doc.published_url ?? '',
    meta: doc.meta && typeof doc.meta === 'object' ? doc.meta : {},
    created_at: doc.created_at ?? null,
  };
}

/**
 * Normalize a raw job into the flat working shape used by the executor (mirrors the
 * desktop normalizeSchedulerJob).
 */
export function normalizeSchedulerJob(rawJob = {}) {
  let payload = {};
  if (rawJob && typeof rawJob.payload === 'object' && !Array.isArray(rawJob.payload)) payload = rawJob.payload;
  else if (typeof rawJob?.payload === 'string' && rawJob.payload.trim()) {
    try {
      const parsed = JSON.parse(rawJob.payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
    } catch {
      payload = {};
    }
  }
  if (payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)) payload = { ...payload.payload, ...payload };

  const sourceBlogId = String(payload.source_blog_id || payload.sourceBlogId || rawJob.source_blog_id || rawJob.sourceBlogId || '').trim();
  const scheduleModeRaw = String(payload.schedule_mode || payload.scheduleMode || rawJob.schedule_mode || rawJob.scheduleMode || '').trim().toLowerCase();
  const scheduleMode = scheduleModeRaw === 'existing' || sourceBlogId ? 'existing' : 'generate';
  const categories = Array.isArray(payload.categories)
    ? payload.categories.map((item) => String(item || '').trim()).filter(Boolean)
    : String(payload.categories || '').split(',').map((item) => item.trim()).filter(Boolean);

  return {
    id: String(rawJob._id || rawJob.id || ''),
    userId: rawJob.user_id ?? null,
    topic: String(rawJob.topic || '').trim(),
    keywords: String(rawJob.keywords || '').trim(),
    runAt: rawJob.run_at instanceof Date ? rawJob.run_at.toISOString() : String(rawJob.run_at || rawJob.runAt || '').trim(),
    status: String(rawJob.status || 'pending').trim().toLowerCase(),
    payload,
    destinationId: String(payload.destination_id || payload.destinationId || rawJob.destination_id || '').trim(),
    platform: String(payload.platform || rawJob.platform || '').trim().toLowerCase(),
    generateImage: schedulerParseBool(payload.generate_image, true),
    autoPost: schedulerParseBool(payload.auto_post, false),
    publishStatus: String(payload.publish_status || 'draft').trim().toLowerCase() === 'publish' ? 'publish' : 'draft',
    focusKeyword: String(payload.focus_keyword || '').trim(),
    writingStyle: String(payload.writing_style || 'professional').trim(),
    writingTone: String(payload.writing_tone || 'friendly').trim(),
    targetWordCount: Math.min(10000, Math.max(300, Number(payload.target_word_count || 2500) || 2500)),
    language: String(payload.language || 'English').trim(),
    useProductContext: schedulerParseBool(payload.use_product_context, false),
    websiteUrl: String(payload.website_url || '').trim(),
    scraperPlatform: String(payload.scraper_platform || rawJob.scraper_platform || 'generic').trim().toLowerCase() || 'generic',
    categories,
    scheduleMode,
    sourceBlogId,
    createdAt: rawJob.created_at instanceof Date ? rawJob.created_at.toISOString() : String(rawJob.created_at || '').trim(),
    updatedAt: rawJob.updated_at instanceof Date ? rawJob.updated_at.toISOString() : String(rawJob.updated_at || '').trim(),
  };
}

export function isSchedulerJobDue(job) {
  if (!job?.runAt) return false;
  const runAtMs = new Date(job.runAt).getTime();
  return Number.isFinite(runAtMs) && runAtMs <= Date.now();
}

export function parseSchedulerDateToMs(value) {
  if (!value) return NaN;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/* ------------------------------ CRUD (scoped to scopeUserId) ------------------------------ */

export async function listJobs(scopeUserId, { status = '', shopId = '', limit = 500 } = {}) {
  const filter = { user_id: scopeUserId };
  if (status) filter.status = status;
  if (shopId) filter.shop_id = shopId;
  const docs = await col('scheduler_jobs').find(filter).sort({ run_at: 1, created_at: -1 }).limit(Number(limit) || 500).toArray();
  return docs.map(mapJob);
}

export async function createJob(scopeUserId, body = {}) {
  const shopId = String(body.shopId ?? '').trim();
  const topic = String(body.topic ?? '').trim();
  const runAt = String(body.runAt ?? '').trim();
  const payload = body.payload && typeof body.payload === 'object' ? { ...body.payload } : {};
  let scheduleMode = String(body.scheduleMode ?? body.schedule_mode ?? payload.schedule_mode ?? 'generate').trim().toLowerCase();
  const sourceBlogId = String(body.sourceBlogId ?? body.source_blog_id ?? payload.source_blog_id ?? '').trim();
  if (sourceBlogId !== '') scheduleMode = 'existing';
  if (shopId === '' || topic === '' || runAt === '') throw new Error('shopId, topic and runAt are required');
  if (scheduleMode === 'existing' && sourceBlogId === '') throw new Error('source_blog_id is required for existing schedule mode');
  payload.schedule_mode = scheduleMode === 'existing' ? 'existing' : 'generate';
  payload.source_blog_id = sourceBlogId;

  const now = new Date();
  const { insertedId } = await col('scheduler_jobs').insertOne({
    user_id: scopeUserId,
    shop_id: shopId,
    topic,
    keywords: String(body.keywords ?? '').trim(),
    schedule_mode: payload.schedule_mode,
    source_blog_id: sourceBlogId,
    payload,
    run_at: toDate(runAt),
    status: 'pending',
    created_at: now,
    updated_at: now,
  });
  return mapJob(await col('scheduler_jobs').findOne({ _id: insertedId }));
}

export async function updateJob(scopeUserId, jobId, updates = {}) {
  const filter = { _id: parseObjectId(jobId), user_id: scopeUserId };
  const set = { updated_at: new Date() };
  const payloadBody = updates.payload && typeof updates.payload === 'object' ? updates.payload : null;
  if (updates.topic !== undefined) set.topic = String(updates.topic).trim();
  if (updates.keywords !== undefined) set.keywords = String(updates.keywords).trim();
  if (updates.runAt !== undefined) set.run_at = toDate(updates.runAt);
  if (updates.status !== undefined) set.status = String(updates.status).trim();
  if (payloadBody !== null) set.payload = payloadBody;
  if (updates.scheduleMode !== undefined || updates.schedule_mode !== undefined || (payloadBody && payloadBody.schedule_mode !== undefined)) {
    const sm = String(updates.scheduleMode ?? updates.schedule_mode ?? payloadBody?.schedule_mode ?? 'generate').trim().toLowerCase();
    set.schedule_mode = sm === 'existing' ? 'existing' : 'generate';
  }
  if (updates.sourceBlogId !== undefined || updates.source_blog_id !== undefined || (payloadBody && payloadBody.source_blog_id !== undefined)) {
    set.source_blog_id = String(updates.sourceBlogId ?? updates.source_blog_id ?? payloadBody?.source_blog_id ?? '').trim();
  }
  if (set.source_blog_id) set.schedule_mode = 'existing';
  if (set.payload && typeof set.payload === 'object') {
    if (set.schedule_mode !== undefined) set.payload.schedule_mode = set.schedule_mode;
    if (set.source_blog_id !== undefined) set.payload.source_blog_id = set.source_blog_id;
  }
  await col('scheduler_jobs').updateOne(filter, { $set: set });
  return mapJob(await col('scheduler_jobs').findOne(filter));
}

export async function deleteJob(scopeUserId, jobId) {
  const { deletedCount } = await col('scheduler_jobs').deleteOne({ _id: parseObjectId(jobId), user_id: scopeUserId });
  return deletedCount > 0;
}

export async function importCsv(scopeUserId, csvContent, defaultShopId = '') {
  const rows = parseCsvToRows(String(csvContent || ''));
  if (rows.length === 0) throw new Error('CSV has no usable rows');
  let created = 0;
  const errors = [];
  const now = new Date();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const shopId = String(row.shop_id ?? row.shopid ?? defaultShopId ?? '').trim();
    const topic = String(row.topic ?? '').trim();
    const keywords = String(row.keywords ?? '').trim();
    let runAtRaw = String(row.run_at ?? row.datetime ?? '').trim();
    if (runAtRaw === '' && row.date) runAtRaw = `${String(row.date).trim()} ${String(row.time ?? '00:00').trim()}`.trim();
    if (shopId === '' || topic === '' || runAtRaw === '') {
      errors.push({ row: i + 2, error: 'Missing shop_id/topic/run_at' });
      continue;
    }
    try {
      await col('scheduler_jobs').insertOne({
        user_id: scopeUserId,
        shop_id: shopId,
        topic,
        keywords,
        payload: { platform: String(row.platform ?? '').trim(), destination_id: String(row.destination_id ?? '').trim() },
        run_at: toDate(runAtRaw),
        status: 'pending',
        created_at: now,
        updated_at: now,
      });
      created += 1;
    } catch (e) {
      errors.push({ row: i + 2, error: e.message });
    }
  }
  return { created, errors };
}

export async function listLogs(scopeUserId, { jobId = '', status = '', limit = 500 } = {}) {
  const filter = { user_id: scopeUserId };
  if (jobId) filter.job_id = jobId;
  if (status) filter.status = status;
  const docs = await col('scheduler_logs').find(filter).sort({ created_at: -1 }).limit(Number(limit) || 500).toArray();
  return docs.map(mapLog);
}

export async function addLog(scopeUserId, log = {}) {
  const { insertedId } = await col('scheduler_logs').insertOne({
    user_id: scopeUserId,
    job_id: String(log.jobId ?? '').trim(),
    shop_id: String(log.shopId ?? '').trim(),
    status: String(log.status ?? 'info').trim(),
    message: String(log.message ?? '').trim(),
    published_url: String(log.publishedUrl ?? '').trim(),
    meta: log.meta && typeof log.meta === 'object' ? log.meta : {},
    created_at: new Date(),
  });
  return String(insertedId);
}

/* ------------------------------ worker helpers (all users) ------------------------------ */

export async function listDueJobs(limit = 1000) {
  const docs = await col('scheduler_jobs').find({ status: 'pending' }).limit(limit).toArray();
  return docs
    .map(normalizeSchedulerJob)
    .filter((job) => job.id && (job.topic || (job.scheduleMode === 'existing' && job.sourceBlogId)) && isSchedulerJobDue(job))
    .sort((a, b) => new Date(a.runAt).getTime() - new Date(b.runAt).getTime());
}

export async function listStaleRunningJobs(staleMs) {
  const docs = await col('scheduler_jobs').find({ status: 'running' }).limit(500).toArray();
  const nowMs = Date.now();
  return docs.map(normalizeSchedulerJob).filter((job) => {
    const last = parseSchedulerDateToMs(job.updatedAt) || parseSchedulerDateToMs(job.createdAt) || parseSchedulerDateToMs(job.runAt);
    return Number.isFinite(last) && nowMs - last > staleMs;
  });
}

export async function setJobStatus(jobId, status) {
  await col('scheduler_jobs').updateOne({ _id: parseObjectId(jobId) }, { $set: { status, updated_at: new Date() } });
}

export async function addWorkerLog({ userId, jobId, shopId = '', status = 'info', message = '', meta = {}, publishedUrl = '' }) {
  await col('scheduler_logs').insertOne({
    user_id: userId ?? null,
    job_id: String(jobId || ''),
    shop_id: String(shopId || ''),
    status: String(status || 'info'),
    message: String(message || '').trim(),
    published_url: String(publishedUrl || ''),
    meta: redactSensitive(meta && typeof meta === 'object' ? meta : {}),
    created_at: new Date(),
  });
}

/* ------------------------------ tiny CSV parser ------------------------------ */

function parseCsvToRows(csv) {
  const text = String(csv || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}
