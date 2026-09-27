// Data layer — a faithful JS port of php-api/db-actions.php (bgDbAction).
// The web backend connects to the SAME MongoDB the PHP/Electron app uses, so the
// collection names and field mappings here mirror the PHP exactly.

import { getDb, toIdFilter, ObjectId } from './mongo.js';
import { redactSensitive } from '../lib/redact.js';

const col = (name) => getDb().collection(name);

/* ----------------------------- helpers ----------------------------- */

function now() {
  return new Date();
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDateFilter(from, to) {
  const fromValue = String(from ?? '').trim();
  const toValue = String(to ?? '').trim();
  if (fromValue === '' && toValue === '') return null;
  const out = {};
  if (fromValue !== '') {
    const v = /^\d{4}-\d{2}-\d{2}$/.test(fromValue) ? `${fromValue}T00:00:00.000Z` : fromValue;
    out.$gte = toDate(v);
  }
  if (toValue !== '') {
    const v = /^\d{4}-\d{2}-\d{2}$/.test(toValue) ? `${toValue}T23:59:59.999Z` : toValue;
    out.$lte = toDate(v);
  }
  return out;
}

function lower(v) {
  return String(v ?? '').toLowerCase();
}

// Locally-uploaded images are logged with category 'image' but are NOT AI-generated
// (cost/tokens are 0). They must be excluded from "images generated" usage metrics.
function isLocalImageLogDoc(doc = {}) {
  if (String(doc?.category ?? '') !== 'image') return false;
  const details = doc?.details;
  let parsed = details;
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch {
      parsed = null;
    }
  }
  if (parsed && String(parsed.source ?? '').toLowerCase() === 'local-upload') return true;
  return /attached local image/i.test(String(doc?.message ?? ''));
}

function matchText(search, fields, doc) {
  const needle = lower(search);
  if (needle === '') return false;
  return fields.some((f) => lower(doc[f]).includes(needle));
}

function isObjectIdString(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

function parseObjectId(id) {
  const raw = String(id ?? '').trim();
  if (ObjectId.isValid(raw) && String(new ObjectId(raw)) === raw) return new ObjectId(raw);
  return raw;
}

function remoteIdCandidates(value) {
  const id = String(value ?? '').trim();
  if (id === '') return [];
  const out = [id];
  if (/^-?\d+$/.test(id)) out.push(parseInt(id, 10));
  return Array.from(new Set(out));
}

function normalizeTopics(topics) {
  if (Array.isArray(topics)) {
    return topics.map((t) => String(t).trim()).filter((t) => t !== '');
  }
  if (typeof topics === 'string') {
    const trimmed = topics.trim();
    if (trimmed === '') return [];
    try {
      const decoded = JSON.parse(trimmed);
      if (Array.isArray(decoded)) return normalizeTopics(decoded);
    } catch {
      /* not json */
    }
    return trimmed.split(',').map((t) => t.trim()).filter((t) => t !== '');
  }
  return [];
}

function isoToMonth(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function actionToLogCategory(action) {
  const prefix = lower(String(action).split('.')[0] || '').trim();
  if (prefix === '') return 'activity';
  const map = {
    blog: 'history',
    auth: 'auth',
    admin: 'admin',
    logs: 'logs',
    posts: 'posts',
    settings: 'settings',
    scheduler: 'scheduler',
    notification: 'notifications',
    notifications: 'notifications',
  };
  return map[prefix] || prefix;
}

function buildLogFilter(payload = {}) {
  const filter = {};
  if (!payload.isAdmin && payload.userId !== undefined) filter.user_id = payload.userId;
  if (payload.level) filter.level = String(payload.level);
  if (payload.category) filter.category = String(payload.category);
  const dateRange = buildDateFilter(payload.dateFrom, payload.dateTo);
  if (dateRange) filter.timestamp = dateRange;
  const search = String(payload.search ?? '').trim();
  if (search !== '') {
    filter.$or = [
      { message: { $regex: search, $options: 'i' } },
      { details: { $regex: search, $options: 'i' } },
      { blog_id: { $regex: search, $options: 'i' } },
    ];
  }
  return filter;
}

/* ----------------------------- mappers ----------------------------- */

function mapBlog(doc) {
  return {
    id: String(doc._id ?? ''),
    user_id: doc.user_id ?? null,
    title: String(doc.title ?? ''),
    topic: String(doc.topic ?? ''),
    content: String(doc.content ?? ''),
    metaDescription: String(doc.meta_description ?? ''),
    keywords: doc.keywords ?? '',
    categories: Array.isArray(doc.categories) ? doc.categories : [],
    imageUrl: String(doc.image_url ?? ''),
    imageGallery: Array.isArray(doc.image_gallery) ? doc.image_gallery : [],
    localImagePath: String(doc.local_image_path ?? ''),
    wordCount: Number(doc.word_count ?? 0),
    seoScore: Number(doc.seo_score ?? 0),
    language: String(doc.language ?? 'en'),
    cost: Number(doc.cost ?? 0),
    genParams: doc.gen_params && typeof doc.gen_params === 'object' ? doc.gen_params : {},
    generatedAt: doc.created_at ?? null,
    updatedAt: doc.updated_at ?? null,
  };
}

function mapUser(doc) {
  return {
    id: String(doc._id ?? ''),
    username: String(doc.username ?? ''),
    email: String(doc.email ?? ''),
    passwordHash: String(doc.password_hash ?? ''),
    passwordSalt: String(doc.password_salt ?? ''),
    role: String(doc.role ?? 'user'),
    status: String(doc.status ?? 'active'),
    permissions: Array.isArray(doc.permissions) ? doc.permissions : [],
    createdAt: doc.created_at ?? null,
    lastOnlineAt: doc.last_online_at ?? null,
    lastLoginAt: doc.last_login_at ?? null,
  };
}

/* ------------------------------ blogs ------------------------------ */

export async function saveBlog(blog = {}, userId = null) {
  const doc = {
    user_id: userId,
    title: String(blog.title ?? ''),
    topic: String(blog.topic ?? ''),
    content: String(blog.content ?? ''),
    meta_description: String(blog.metaDescription ?? ''),
    keywords: blog.keywords ?? '',
    categories: blog.categories ?? [],
    image_url: String(blog.imageUrl ?? ''),
    image_gallery: Array.isArray(blog.imageGallery) ? blog.imageGallery : [],
    local_image_path: String(blog.localImagePath ?? blog.local_image_path ?? ''),
    word_count: Number(blog.wordCount ?? 0),
    seo_score: Number(blog.seoScore ?? 0),
    language: String(blog.language ?? 'en'),
    cost: Number(blog.cost ?? 0),
    gen_params: blog.genParams && typeof blog.genParams === 'object' ? blog.genParams : {},
    created_at: now(),
    updated_at: now(),
  };
  const { insertedId } = await col('blogs').insertOne(doc);
  return String(insertedId);
}

export async function listBlogs(opt = {}) {
  const filter = {};
  if (opt.userId) filter.user_id = opt.userId;
  const dateRange = buildDateFilter(opt.dateFrom, opt.dateTo);
  if (dateRange) filter.created_at = dateRange;
  const findOptions = {};
  if (opt.minimal) {
    // History list: only the columns the list + CSV need. Smallest possible payload.
    findOptions.projection = {
      title: 1,
      word_count: 1,
      seo_score: 1,
      language: 1,
      cost: 1,
      created_at: 1,
      updated_at: 1,
      user_id: 1,
    };
  } else if (opt.lean) {
    // List views (scheduler blog picker) don't need the full HTML body or the image data —
    // which can be huge when images are stored inline as base64 data-URLs. Excluding them
    // keeps the payload small. Detail views re-fetch the complete document via getBlogById.
    findOptions.projection = { content: 0, image_gallery: 0, image_url: 0, local_image_path: 0 };
  }
  const docs = await col('blogs')
    .find(filter, findOptions)
    .sort({ created_at: -1 })
    .skip(Number(opt.offset ?? 0))
    .limit(Number(opt.limit ?? 50))
    .toArray();
  let rows = docs.map(mapBlog);
  const search = String(opt.search ?? '').trim();
  if (search !== '') rows = rows.filter((r) => matchText(search, ['title', 'keywords'], r));
  return rows;
}

export async function getBlogById(id, opt = {}) {
  const filter = { _id: parseObjectId(id) };
  if (!opt.isAdmin && opt.userId !== undefined) filter.user_id = opt.userId;
  const doc = await col('blogs').findOne(filter);
  return doc ? mapBlog(doc) : null;
}

export async function getBlogsByIds(ids = [], opt = {}) {
  const rows = [];
  for (const id of ids) {
    const filter = { _id: parseObjectId(String(id)) };
    if (!opt.isAdmin && opt.userId !== undefined) filter.user_id = opt.userId;
    const doc = await col('blogs').findOne(filter);
    if (doc) rows.push(mapBlog(doc));
  }
  return rows;
}

export async function updateBlog({ blog = {}, userId, isAdmin = false } = {}) {
  const filter = { _id: parseObjectId(blog.id ?? '') };
  if (!isAdmin && userId !== undefined) filter.user_id = userId;
  const set = { updated_at: now() };
  const fieldMap = {
    title: 'title',
    topic: 'topic',
    content: 'content',
    metaDescription: 'meta_description',
    keywords: 'keywords',
    categories: 'categories',
    imageUrl: 'image_url',
    imageGallery: 'image_gallery',
    localImagePath: 'local_image_path',
    wordCount: 'word_count',
    seoScore: 'seo_score',
    language: 'language',
    cost: 'cost',
    genParams: 'gen_params',
  };
  for (const [src, dst] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(blog, src)) set[dst] = blog[src];
  }
  await col('blogs').updateOne(filter, { $set: set });
  return true;
}

export async function deleteBlog({ id, userId, isAdmin = false } = {}) {
  const filter = { _id: parseObjectId(id ?? '') };
  if (!isAdmin && userId !== undefined) filter.user_id = userId;
  const { deletedCount } = await col('blogs').deleteOne(filter);
  return deletedCount > 0;
}

export async function clearBlogs({ userId, isAdmin = false } = {}) {
  const filter = isAdmin ? {} : { user_id: userId ?? null };
  await col('blogs').deleteMany(filter);
  return true;
}

export async function getHistorySummary({ userId, isAdmin = false } = {}) {
  const filter = {};
  if (!isAdmin && userId !== undefined) filter.user_id = userId;
  // Count + sum server-side instead of pulling up to 20k documents over the wire.
  const [agg] = await col('blogs')
    .aggregate([
      { $match: filter },
      { $group: { _id: null, totalCount: { $sum: 1 }, totalCost: { $sum: { $ifNull: ['$cost', 0] } } } },
    ])
    .toArray();
  return { totalCount: agg?.totalCount || 0, totalCost: Number(agg?.totalCost || 0) };
}

// Recover the original generation settings for a blog from its generation logs (used when
// the blog predates gen_params being stored). Anchors on the "Completed generation" log
// (carries blog_id + user) and reads the "Starting generation" log just before it.
export async function recoverGenParamsFromLogs(blogId, { userId, isAdmin = false } = {}) {
  const id = String(blogId || '');
  if (!id) return null;
  const WINDOW_MS = 30 * 60 * 1000;
  const logsCol = col('logs');

  const completedRows = await logsCol
    .find({ blog_id: id, category: 'generation' })
    .sort({ timestamp: -1 })
    .limit(5)
    .toArray();
  const completedLog = completedRows.find((l) => /^completed generation/i.test(String(l.message || '')));

  let anchorMs = completedLog ? new Date(completedLog.timestamp).getTime() : NaN;
  let anchorUser = completedLog ? completedLog.user_id : null;
  if (!Number.isFinite(anchorMs)) {
    try {
      const blogDoc = await col('blogs').findOne({ _id: parseObjectId(id) }, { projection: { created_at: 1, user_id: 1 } });
      anchorMs = blogDoc ? new Date(blogDoc.created_at).getTime() : NaN;
      anchorUser = anchorUser ?? blogDoc?.user_id ?? null;
    } catch {
      /* ignore */
    }
  }
  if (!Number.isFinite(anchorMs)) return null;

  const base = { category: 'generation', timestamp: { $gte: new Date(anchorMs - WINDOW_MS), $lte: new Date(anchorMs) } };
  const filters = anchorUser != null ? [{ ...base, user_id: anchorUser }, base] : [base];
  let startLog = null;
  for (const filter of filters) {
    const rows = await logsCol.find(filter).sort({ timestamp: -1 }).limit(15).toArray();
    startLog = rows.find((l) => /^starting generation/i.test(String(l.message || '')));
    if (startLog) break;
  }
  if (!startLog) return null;

  let details = startLog.details;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch {
      details = {};
    }
  }
  if (!details || typeof details !== 'object') details = {};
  const s = details.settings && typeof details.settings === 'object' ? details.settings : {};
  const pick = (...vals) => {
    for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
    return undefined;
  };

  const gp = {};
  const kw = pick(details.keywords, s.keywords);
  if (kw && (Array.isArray(kw) ? kw.length : String(kw).trim())) gp.keywords = Array.isArray(kw) ? kw : String(kw);
  const ws = pick(details.writingStyle, s.writingStyle, s.writing_style);
  if (ws) gp.writingStyle = String(ws);
  const wt = pick(details.writingTone, s.writingTone, s.writing_tone);
  if (wt) gp.writingTone = String(wt);
  const twc = pick(details.targetWordCount, s.targetWordCount, s.target_word_count);
  if (twc != null && Number(twc) > 0) gp.targetWordCount = Number(twc);
  const fk = pick(details.focusKeyword, s.focusKeyword, s.focus_keyword);
  if (fk) gp.focusKeyword = String(fk);
  const lang = pick(details.language, s.language);
  if (lang) gp.language = String(lang);
  const upc = pick(details.useProductContext, s.useProductContext, s.use_product_context);
  if (typeof upc === 'boolean') gp.useProductContext = upc;
  const wu = pick(s.websiteUrl, s.website_url, s.siteBaseUrl, s.site_base_url);
  if (wu) gp.websiteUrl = String(wu);
  const sp = pick(s.scraperPlatform, s.scraper_platform);
  if (sp) gp.scraperPlatform = String(sp);

  return Object.keys(gp).length ? gp : null;
}

/* ------------------------------ users ------------------------------ */

export async function getUserByUsername(username) {
  const doc = await col('users').findOne({ username: String(username ?? '') });
  return doc ? mapUser(doc) : null;
}

export async function getUserById(id) {
  const doc = await col('users').findOne({ _id: parseObjectId(id ?? '') });
  return doc ? mapUser(doc) : null;
}

export async function createUser(payload = {}) {
  const username = String(payload.username ?? '').trim();
  if (username === '') throw new Error('Username is required');
  const existing = await col('users').findOne({
    username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  if (existing) throw new Error('Username already exists');
  const { insertedId } = await col('users').insertOne({
    username,
    email: String(payload.email ?? ''),
    password_hash: String(payload.passwordHash ?? ''),
    password_salt: String(payload.passwordSalt ?? ''),
    role: String(payload.role ?? 'user'),
    status: String(payload.status ?? 'active'),
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    created_at: now(),
  });
  return String(insertedId);
}

export async function getUserCount() {
  return col('users').countDocuments({});
}

export async function listUsers() {
  const docs = await col('users').find({}).sort({ _id: 1 }).limit(5000).toArray();
  return docs.map((doc) => {
    const u = mapUser(doc);
    delete u.passwordHash;
    delete u.passwordSalt;
    return u;
  });
}

export async function updateUserAccess(payload = {}) {
  const set = {};
  for (const field of ['role', 'permissions', 'email', 'status']) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) set[field] = payload[field];
  }
  if (Object.keys(set).length === 0) return true;
  await col('users').updateOne({ _id: parseObjectId(payload.id ?? '') }, { $set: set });
  return true;
}

export async function updateUserPassword(payload = {}) {
  await col('users').updateOne({ _id: parseObjectId(payload.id ?? '') }, {
    $set: {
      password_hash: String(payload.passwordHash ?? ''),
      password_salt: String(payload.passwordSalt ?? ''),
      updated_at: now(),
    },
  });
  return true;
}

export async function touchUserLastOnline(payload = {}) {
  const id = String(payload.id ?? '').trim();
  if (id === '') return false;
  const ts = now();
  await col('users').updateOne({ _id: parseObjectId(id) }, {
    $set: { last_online_at: ts, last_login_at: ts, updated_at: ts },
  });
  return true;
}

export async function deleteUser(payload = {}) {
  const { deletedCount } = await col('users').deleteOne({ _id: parseObjectId(payload.id ?? '') });
  return deletedCount;
}

/* ----------------------------- settings ---------------------------- */

export async function setSetting(payload = {}) {
  const key = String(payload.key ?? '');
  await col('settings').updateOne(
    { user_id: payload.userId ?? null, key },
    { $set: { user_id: payload.userId ?? null, key, value: payload.value ?? null, updated_at: now() } },
    { upsert: true }
  );
  return true;
}

export async function getSetting(payload = {}) {
  const doc = await col('settings').findOne({ user_id: payload.userId ?? null, key: String(payload.key ?? '') });
  return doc ? (doc.value ?? null) : null;
}

/* ------------------------ activities / logs ------------------------ */

export async function logActivity(payload = {}) {
  const action = String(payload.action ?? '');
  const details = String(payload.details ?? '');
  const userId = payload.userId ?? null;
  await col('activities').insertOne({ user_id: userId, action, details, created_at: now() });
  await col('logs').insertOne({
    timestamp: now(),
    level: 'info',
    category: actionToLogCategory(action),
    message: details !== '' ? details : action !== '' ? action : 'Activity',
    details: JSON.stringify({ source: 'activity', action }),
    blog_id: null,
    tokens_used: null,
    cost: null,
    user_id: userId,
  });
  return true;
}

export async function listActivities(payload = {}) {
  const filter = {};
  if (!payload.isAdmin && payload.userId !== undefined) filter.user_id = payload.userId;
  const activities = await col('activities')
    .find(filter)
    .sort({ created_at: -1 })
    .limit(Number(payload.limit ?? 50))
    .toArray();
  // The logs route maps usernames itself (cached), so it passes skipUserMap to avoid a
  // second full users load per request.
  const userMap = {};
  if (!payload.skipUserMap) {
    const users = await col('users').find({}, { projection: { username: 1 } }).limit(5000).toArray();
    for (const u of users) userMap[String(u._id)] = String(u.username ?? 'System');
  }
  return activities.map((doc) => {
    const uid = String(doc.user_id ?? '');
    return {
      id: String(doc._id ?? ''),
      userId: uid,
      username: userMap[uid] ?? 'System',
      action: String(doc.action ?? ''),
      details: String(doc.details ?? ''),
      createdAt: doc.created_at ?? null,
    };
  });
}

export async function addLog(payload = {}) {
  await col('logs').insertOne({
    timestamp: now(),
    level: String(payload.level ?? 'info'),
    category: String(payload.category ?? 'general'),
    message: String(payload.message ?? ''),
    details: payload.details !== undefined ? JSON.stringify(redactSensitive(payload.details)) : null,
    blog_id: payload.blogId ?? null,
    tokens_used: payload.tokensUsed !== undefined ? Number(payload.tokensUsed) : null,
    cost: payload.cost !== undefined ? Number(payload.cost) : null,
    user_id: payload.userId ?? null,
  });
  return true;
}

export async function listLogs(payload = {}) {
  const filter = buildLogFilter(payload);
  let limit = Number(payload.limit ?? 100);
  if (!Number.isFinite(limit) || limit < 1) limit = 100;
  if (limit > 20000) limit = 20000;
  const docs = await col('logs')
    .find(filter)
    .sort({ timestamp: -1 })
    .skip(Number(payload.offset ?? 0))
    .limit(limit)
    .toArray();
  return docs.map((doc) => {
    const details = doc.details ?? null;
    let parsed = null;
    if (typeof details === 'string') {
      try {
        parsed = JSON.parse(details);
      } catch {
        parsed = null;
      }
    }
    return {
      id: String(doc._id ?? ''),
      timestamp: doc.timestamp ?? null,
      level: String(doc.level ?? ''),
      category: String(doc.category ?? ''),
      message: String(doc.message ?? ''),
      details,
      blogId: doc.blog_id ?? parsed?.blogId ?? null,
      tokensUsed: doc.tokens_used ?? parsed?.tokensUsed ?? null,
      cost: doc.cost ?? parsed?.cost ?? null,
      userId: doc.user_id ?? null,
    };
  });
}

export async function getLogStats(payload = {}) {
  const filter = buildLogFilter(payload);
  const total = await col('logs').countDocuments(filter);

  let errors = 0;
  const levelFilter = String(payload.level ?? '').trim();
  if (levelFilter === '' || levelFilter.toLowerCase() === 'error') {
    const errorFilter = { ...filter };
    if (levelFilter === '') errorFilter.level = 'error';
    errors = await col('logs').countDocuments(errorFilter);
  }

  let totalTokens = 0;
  let totalCost = 0;
  let imageCount = 0;
  try {
    const agg = await col('logs')
      .aggregate([
        { $match: Object.keys(filter).length ? filter : {} },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: { $ifNull: ['$tokens_used', 0] } },
            totalCost: { $sum: { $ifNull: ['$cost', 0] } },
            // Count only AI-generated images — exclude locally-uploaded ones (source
            // 'local-upload' / "Attached local image"), which carry 0 cost & 0 tokens.
            imageCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$category', 'image'] },
                      {
                        $not: [
                          {
                            $regexMatch: {
                              input: { $ifNull: [{ $toString: '$details' }, ''] },
                              regex: 'local-upload',
                              options: 'i',
                            },
                          },
                        ],
                      },
                      {
                        $not: [
                          {
                            $regexMatch: {
                              input: { $ifNull: [{ $toString: '$message' }, ''] },
                              regex: 'attached local image',
                              options: 'i',
                            },
                          },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();
    if (agg[0]) {
      totalTokens = Number(agg[0].totalTokens ?? 0);
      totalCost = Number(agg[0].totalCost ?? 0);
      imageCount = Number(agg[0].imageCount ?? 0);
    }
  } catch {
    const rows = await col('logs').find(filter).limit(50000).toArray();
    for (const r of rows) {
      totalTokens += Number(r.tokens_used ?? 0);
      totalCost += Number(r.cost ?? 0);
      if ((r.category ?? '') === 'image' && !isLocalImageLogDoc(r)) imageCount++;
    }
  }

  return { total, errors, totalTokens, totalCost, imageCount };
}

export async function getLogTrend(payload = {}) {
  const rows = await listLogs(payload);
  const buckets = {};
  for (const r of rows) {
    const ts = r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp ?? '');
    const day = ts.slice(0, 10);
    if (day === '') continue;
    if (!buckets[day]) buckets[day] = { date: day, count: 0, totalTokens: 0, totalCost: 0, imageCount: 0 };
    buckets[day].count++;
    buckets[day].totalTokens += Number(r.tokensUsed ?? 0);
    buckets[day].totalCost += Number(r.cost ?? 0);
    if ((r.category ?? '') === 'image' && !isLocalImageLogDoc(r)) buckets[day].imageCount++;
  }
  return Object.keys(buckets).sort().map((k) => buckets[k]);
}

export async function clearLogs(payload = {}) {
  const filter = payload.isAdmin ? {} : { user_id: payload.userId ?? null };
  await col('logs').deleteMany(filter);
  return true;
}

/* --------------------------- notifications ------------------------- */

export async function addNotification(payload = {}) {
  const { insertedId } = await col('notifications').insertOne({
    user_id: payload.userId ?? null,
    type: String(payload.type ?? 'info'),
    message: String(payload.message ?? ''),
    is_read: false,
    created_at: now(),
  });
  return String(insertedId);
}

export async function listNotifications(payload = {}) {
  const filter = {};
  if (!payload.isAdmin && payload.userId !== undefined) filter.user_id = payload.userId;
  const docs = await col('notifications')
    .find(filter)
    .sort({ created_at: -1 })
    .limit(Number(payload.limit ?? 100))
    .toArray();
  return docs.map((doc) => ({
    id: String(doc._id ?? ''),
    userId: doc.user_id ?? null,
    type: String(doc.type ?? ''),
    message: String(doc.message ?? ''),
    isRead: Boolean(doc.is_read ?? false),
    createdAt: doc.created_at ?? null,
  }));
}

export async function markNotificationRead(payload = {}) {
  const filter = { _id: parseObjectId(payload.id ?? '') };
  if (!payload.isAdmin && payload.userId !== undefined) filter.user_id = payload.userId;
  await col('notifications').updateOne(filter, { $set: { is_read: true } });
  return true;
}

export async function clearNotifications(payload = {}) {
  const filter = payload.isAdmin ? {} : { user_id: payload.userId ?? null };
  await col('notifications').deleteMany(filter);
  return true;
}

/* ----------------------------- api usage --------------------------- */

export async function trackApiUsage(payload = {}) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  await col('api_usage').updateOne(
    { user_id: payload.userId ?? null, date: dayStart },
    {
      $inc: {
        blogs_generated: 1,
        total_cost: Number(payload.cost ?? 0),
        total_tokens: Number(payload.tokens ?? 0),
      },
      $setOnInsert: { user_id: payload.userId ?? null, date: dayStart },
    },
    { upsert: true }
  );
  return true;
}

export async function getApiUsage(payload = {}) {
  const filter = {};
  if (!payload.isAdmin && payload.userId !== undefined) filter.user_id = payload.userId;
  const range = buildDateFilter(payload.dateFrom, payload.dateTo);
  if (range) filter.date = range;
  const docs = await col('api_usage').find(filter).limit(5000).toArray();
  const out = { date: null, blogsGenerated: 0, totalCost: 0, totalTokens: 0 };
  for (const d of docs) {
    out.blogsGenerated += Number(d.blogs_generated ?? 0);
    out.totalCost += Number(d.total_cost ?? 0);
    out.totalTokens += Number(d.total_tokens ?? 0);
  }
  return out;
}

/* -------------------------- publish history ------------------------ */

export async function recordPublishHistory(entry = {}) {
  const { insertedId } = await col('publish_history').insertOne({
    blog_id: entry.blogId ?? null,
    remote_post_id: entry.remotePostId ?? null,
    destination_id: entry.destinationId ?? null,
    destination_name: entry.destinationName ?? '',
    platform: entry.platform ?? '',
    status: entry.status ?? '',
    published_url: entry.publishedUrl ?? '',
    published_at: toDate(entry.publishedAt) ?? now(),
    user_id: entry.userId ?? null,
  });
  return String(insertedId);
}

export async function updatePublishHistoryStatusByRemotePost({ remotePostId, destinationId = null, status } = {}) {
  if (!remotePostId || typeof status === 'undefined') return { matchedCount: 0, modifiedCount: 0 };
  const rawId = String(remotePostId).trim();
  if (!rawId) return { matchedCount: 0, modifiedCount: 0 };
  const candidates = [rawId];
  if (/^-?\d+$/.test(rawId)) candidates.push(Number(rawId));
  const filter = { remote_post_id: candidates.length > 1 ? { $in: candidates } : candidates[0] };
  if (destinationId) filter.destination_id = destinationId;
  return col('publish_history').updateMany(filter, { $set: { status } });
}

// Latest publish status for every blog in the workspace, in ONE query (avoids the
// per-blog N+1 the History page used to do). Returns a map keyed by blog id.
export async function getPublishStatusMap({ userId } = {}) {
  const filter = {};
  if (userId) filter.user_id = userId;
  const docs = await col('publish_history')
    .find(filter, {
      projection: { blog_id: 1, status: 1, destination_name: 1, published_url: 1, published_at: 1 },
    })
    .sort({ published_at: -1 })
    .limit(50000)
    .toArray();
  const map = {};
  for (const doc of docs) {
    const blogId = String(doc.blog_id ?? '');
    if (!blogId || map[blogId]) continue; // first seen wins = latest (sorted desc)
    map[blogId] = {
      status: doc.status ?? '',
      destinationName: doc.destination_name ?? '',
      publishedUrl: doc.published_url ?? '',
      publishedAt: doc.published_at ?? null,
    };
  }
  return map;
}

export async function getPublishHistoryByBlog(blogId) {
  const docs = await col('publish_history')
    .find({ blog_id: String(blogId ?? '') })
    .sort({ published_at: -1 })
    .limit(500)
    .toArray();
  return docs.map((doc) => ({
    id: String(doc._id ?? ''),
    blogId: doc.blog_id ?? null,
    remotePostId: doc.remote_post_id ?? null,
    destinationId: doc.destination_id ?? null,
    destinationName: doc.destination_name ?? '',
    platform: doc.platform ?? '',
    status: doc.status ?? '',
    publishedUrl: doc.published_url ?? '',
    publishedAt: doc.published_at ?? null,
    userId: doc.user_id ?? null,
  }));
}

export async function getPublishHistory(payload = {}) {
  const filter = {};
  if (payload.userId) filter.user_id = payload.userId;
  if (payload.platform) filter.platform = payload.platform;
  if (payload.status) filter.status = payload.status;
  if (payload.destinationId) filter.destination_id = payload.destinationId;
  const range = buildDateFilter(payload.dateFrom, payload.dateTo);
  if (range) filter.published_at = range;
  const docs = await col('publish_history')
    .find(filter)
    .sort({ published_at: -1 })
    .skip(Number(payload.offset ?? 0))
    .limit(Number(payload.limit ?? 100))
    .toArray();

  // Resolve blog titles in one batch (publish_history stores only blog_id).
  const blogIds = [...new Set(docs.map((d) => String(d.blog_id ?? '')).filter((id) => ObjectId.isValid(id)))];
  const titleMap = {};
  if (blogIds.length) {
    const blogs = await col('blogs')
      .find({ _id: { $in: blogIds.map((id) => new ObjectId(id)) } }, { projection: { title: 1 } })
      .toArray();
    for (const b of blogs) titleMap[String(b._id)] = b.title || '';
  }

  // The renderer reads camelCase (blogTitle / destinationName / publishedAt), so map to that.
  return docs.map((doc) => ({
    id: String(doc._id ?? ''),
    blogId: doc.blog_id ?? null,
    blogTitle: titleMap[String(doc.blog_id ?? '')] || '',
    remotePostId: doc.remote_post_id ?? null,
    destinationId: doc.destination_id ?? null,
    destinationName: doc.destination_name ?? '',
    platform: doc.platform ?? '',
    status: doc.status ?? '',
    publishedUrl: doc.published_url ?? '',
    publishedAt: doc.published_at ?? null,
    userId: doc.user_id ?? null,
  }));
}

export async function getPublishAnalytics(payload = {}) {
  const historyFilter = {};
  if (payload.userId) historyFilter.user_id = payload.userId;
  if (payload.destinationId) historyFilter.destination_id = payload.destinationId;
  const range = buildDateFilter(payload.dateFrom, payload.dateTo);
  if (range) historyFilter.published_at = range;

  const historyRows = await col('publish_history')
    .find(historyFilter)
    .sort({ published_at: -1 })
    .limit(5000)
    .toArray();

  const remotePosts = await listRemotePosts({ limit: 1000, destinationId: payload.destinationId ?? null });
  const remoteMap = {};
  let totalTimeSpent = 0;
  for (const post of remotePosts) {
    remoteMap[String(post.id ?? '')] = post;
    totalTimeSpent += Number(post.timeSpent ?? 0);
  }
  const useRemoteStats = remotePosts.length > 0;

  let totalPublished = 0;
  let totalDrafts = 0;
  let totalViews = 0;
  if (useRemoteStats) {
    for (const post of remotePosts) {
      if (post.status === 'publish') totalPublished++;
      if (post.status === 'draft') totalDrafts++;
      totalViews += Number(post.views ?? 0);
    }
  } else {
    for (const row of historyRows) {
      if (row.status === 'publish') totalPublished++;
      if (row.status === 'draft') totalDrafts++;
      const remote = remoteMap[String(row.remote_post_id ?? '')];
      totalViews += Number(remote?.views ?? 0);
    }
  }

  const publishedByMonth = {};
  if (useRemoteStats) {
    for (const post of remotePosts) {
      const month = isoToMonth(post.publishedAt ?? post.createdAt ?? post.updatedAt ?? '');
      if (!month) continue;
      if (!publishedByMonth[month]) publishedByMonth[month] = { month, count: 0, views: 0 };
      publishedByMonth[month].count++;
      publishedByMonth[month].views += Number(post.views ?? 0);
    }
  } else {
    for (const row of historyRows) {
      const month = isoToMonth(row.published_at ?? '');
      if (!month) continue;
      if (!publishedByMonth[month]) publishedByMonth[month] = { month, count: 0, views: 0 };
      publishedByMonth[month].count++;
      const remote = remoteMap[String(row.remote_post_id ?? '')];
      publishedByMonth[month].views += Number(remote?.views ?? 0);
    }
  }

  const byPlatform = {};
  if (useRemoteStats) {
    for (const post of remotePosts) {
      const platform = String(post.provider ?? 'unknown');
      if (!byPlatform[platform]) byPlatform[platform] = { platform, count: 0, views: 0 };
      byPlatform[platform].count++;
      byPlatform[platform].views += Number(post.views ?? 0);
    }
  } else {
    for (const row of historyRows) {
      const platform = String(row.platform ?? 'unknown');
      if (!byPlatform[platform]) byPlatform[platform] = { platform, count: 0, views: 0 };
      byPlatform[platform].count++;
      const remote = remoteMap[String(row.remote_post_id ?? '')];
      byPlatform[platform].views += Number(remote?.views ?? 0);
    }
  }

  const topicViews = {};
  const topicCounts = {};
  for (const post of remotePosts) {
    for (const topic of normalizeTopics(post.topics ?? [])) {
      const key = lower(topic);
      topicViews[key] = (topicViews[key] ?? 0) + Number(post.views ?? 0);
      topicCounts[key] = (topicCounts[key] ?? 0) + 1;
    }
  }
  const topTopics = Object.entries(topicViews)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, totalTopicViews]) => {
      const count = topicCounts[topic] ?? 0;
      return {
        topic,
        totalViews: totalTopicViews,
        postCount: count,
        avgViews: count > 0 ? Math.round(totalTopicViews / count) : 0,
      };
    });

  const topPosts = remotePosts
    .filter((p) => p.views !== undefined && p.views !== null && !Number.isNaN(Number(p.views)))
    .sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0))
    .slice(0, 10)
    .map((p) => ({
      id: p.id ?? null,
      title: p.title ?? '',
      views: Number(p.views ?? 0),
      publishedAt: p.publishedAt ?? null,
      url: p.url ?? null,
      status: p.status ?? '',
    }));

  const recentPublishes = historyRows.slice(0, 10).map((row) => ({
    id: String(row._id ?? ''),
    blogId: row.blog_id ?? null,
    destinationName: row.destination_name ?? '',
    platform: row.platform ?? '',
    status: row.status ?? '',
    publishedAt: row.published_at ?? null,
    publishedUrl: row.published_url ?? '',
  }));

  const remotePostCount = remotePosts.length;
  return {
    summary: {
      totalPublished,
      totalDrafts,
      totalViews,
      avgViewsPerPost: remotePostCount > 0 ? Math.round(totalViews / remotePostCount) : 0,
      totalTimeSpentSeconds: totalTimeSpent,
      avgTimePerPostSeconds: remotePostCount > 0 ? Math.round(totalTimeSpent / remotePostCount) : 0,
    },
    publishedByMonth: Object.keys(publishedByMonth).sort().map((k) => publishedByMonth[k]),
    byPlatform: Object.values(byPlatform).sort((a, b) => b.count - a.count),
    topTopics,
    topPosts,
    recentPublishes,
  };
}

/* ---------------------------- remote posts ------------------------- */

export async function upsertRemotePosts(posts = [], provider = 'wordpress') {
  const prov = String(provider ?? 'wordpress').trim() || 'wordpress';
  for (const post of posts) {
    if (!post || typeof post !== 'object') continue;
    const id = String(post.id ?? '').trim();
    if (id === '') continue;
    const set = {
      id,
      provider: prov,
      destination_id: post.destination_id ?? null,
      title: String(post.title ?? ''),
      status: String(post.status ?? ''),
      url: post.url ?? null,
      created_at: toDate(post.created_at),
      updated_at: toDate(post.updated_at),
      published_at: toDate(post.published_at),
      views: post.views !== undefined ? Number(post.views) : 0,
      last_viewed: toDate(post.last_viewed),
      time_spent: post.time_spent !== undefined && post.time_spent !== null ? Number(post.time_spent) : null,
      topics: normalizeTopics(post.topics ?? []),
      synced_at: now(),
    };
    await col('remote_posts').updateOne({ id, provider: prov }, { $set: set }, { upsert: true });
  }
  return true;
}

export async function replaceRemotePosts(posts = [], provider = 'wordpress', destinationId = null) {
  const prov = String(provider ?? 'wordpress').trim() || 'wordpress';
  if (destinationId !== null && destinationId !== '') {
    await col('remote_posts').deleteMany({ provider: prov, destination_id: destinationId });
  }
  return upsertRemotePosts(posts, prov);
}

export async function deleteRemotePost(payload = {}) {
  const id = String(payload.id ?? '').trim();
  if (id === '') return true;
  const candidates = remoteIdCandidates(id);
  const filter = candidates.length > 1 ? { id: { $in: candidates } } : { id };
  if (payload.provider) filter.provider = String(payload.provider);
  if (payload.destinationId) filter.destination_id = payload.destinationId;
  const { deletedCount } = await col('remote_posts').deleteOne(filter);
  return deletedCount > 0;
}

export async function listRemotePosts(payload = {}) {
  const filter = {};
  if (payload.status) filter.status = String(payload.status);
  if (payload.destinationId) filter.destination_id = payload.destinationId;
  const docs = await col('remote_posts')
    .find(filter)
    .sort({ synced_at: -1 })
    .limit(Number(payload.limit ?? 200))
    .toArray();
  return docs.map((doc) => ({
    id: doc.id ?? null,
    provider: doc.provider ?? '',
    destinationId: doc.destination_id ?? null,
    title: doc.title ?? '',
    status: doc.status ?? '',
    url: doc.url ?? null,
    createdAt: doc.created_at ?? null,
    updatedAt: doc.updated_at ?? null,
    publishedAt: doc.published_at ?? null,
    views: doc.views !== undefined && doc.views !== null && !Number.isNaN(Number(doc.views)) ? Number(doc.views) : null,
    lastViewed: doc.last_viewed ?? null,
    timeSpent: doc.time_spent !== undefined && doc.time_spent !== null && !Number.isNaN(Number(doc.time_spent)) ? Number(doc.time_spent) : null,
    topics: normalizeTopics(doc.topics ?? []),
    syncedAt: doc.synced_at ?? null,
  }));
}

export async function getBlogForRemotePost(payload = {}) {
  const remotePostId = String(payload.remotePostId ?? '').trim();
  if (remotePostId === '') return null;
  const candidates = remoteIdCandidates(remotePostId);
  const filter = candidates.length > 1 ? { remote_post_id: { $in: candidates } } : { remote_post_id: remotePostId };
  if (payload.destinationId) filter.destination_id = payload.destinationId;
  const rows = await col('publish_history').find(filter).sort({ published_at: -1 }).limit(1).toArray();
  const blogId = String(rows[0]?.blog_id ?? '');
  if (blogId === '' || !isObjectIdString(blogId)) return null;
  const doc = await col('blogs').findOne({ _id: parseObjectId(blogId) });
  return doc ? mapBlog(doc) : null;
}

export async function getRemotePostAnalytics() {
  const posts = await listRemotePosts({ limit: 10000 });
  const totalPosts = posts.length;
  let totalPublished = 0;
  let totalDrafts = 0;
  let totalViews = 0;
  for (const post of posts) {
    if (post.status === 'publish') totalPublished++;
    if (post.status === 'draft') totalDrafts++;
    totalViews += Number(post.views ?? 0);
  }
  return {
    summary: {
      totalPosts,
      totalPublished,
      totalDrafts,
      totalViews,
      avgViewsPerPost: totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0,
    },
  };
}

/* --------------------------- analytics ----------------------------- */

export async function logAnalyticsEvent(event = {}) {
  await col('events').insertOne({
    session_id: event.session_id ?? null,
    user_id: event.user_id ?? null,
    event: String(event.event ?? ''),
    props: event.props && typeof event.props === 'object' ? event.props : {},
    screen_name: event.screen_name ?? null,
    created_at: toDate(event.created_at) ?? now(),
  });
  return true;
}

export async function upsertSession(payload = {}) {
  const sessionId = String(payload.sessionId ?? '').trim();
  if (sessionId === '') return true;
  const ts = now();
  await col('sessions').updateOne(
    { session_id: sessionId },
    {
      $setOnInsert: { session_id: sessionId, started_at: ts, first_touch: payload.firstTouch ?? null },
      $set: {
        user_id: payload.userId ?? null,
        last_touch: payload.lastTouch ?? null,
        landing: payload.landing ?? null,
        device: payload.device ?? null,
        last_seen: ts,
      },
    },
    { upsert: true }
  );
  return true;
}

export async function heartbeatSession(payload = {}) {
  const sessionId = String(payload.sessionId ?? '').trim();
  if (sessionId === '') return true;
  await col('sessions').updateOne({ session_id: sessionId }, { $set: { last_seen: now() } });
  return true;
}

export async function endSession(payload = {}) {
  const sessionId = String(payload.sessionId ?? '').trim();
  if (sessionId === '') return true;
  const session = await col('sessions').findOne({ session_id: sessionId });
  if (!session) return true;
  let duration = 0;
  const startedAt = toDate(session.started_at);
  if (startedAt) duration = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  await col('sessions').updateOne({ session_id: sessionId }, {
    $set: { ended_at: now(), duration_sec: duration, last_seen: now() },
  });
  return true;
}

export async function getRealtimeAnalytics(payload = {}) {
  let windowMinutes = Number(payload.windowMinutes ?? 10);
  if (!Number.isFinite(windowMinutes) || windowMinutes < 1) windowMinutes = 1;
  const nowMs = Date.now();
  const since = new Date(nowMs - windowMinutes * 60 * 1000);
  const activeSince = new Date(nowMs - 60000);

  const recentEvents = await col('events').find({ created_at: { $gte: since } }).limit(5000).toArray();
  const activeSessions = await col('sessions').find({ last_seen: { $gte: activeSince } }).limit(5000).toArray();

  const screenCounts = {};
  let liveConversions = 0;
  let liveErrors = 0;
  for (const event of recentEvents) {
    const name = String(event.event ?? '');
    const screen = String(event.screen_name ?? '');
    if (name === 'screen_view' && screen !== '') screenCounts[screen] = (screenCounts[screen] ?? 0) + 1;
    if (['purchase', 'subscription_start', 'signup_complete'].includes(name)) liveConversions++;
    if (name === 'error') liveErrors++;
  }
  const topScreens = Object.entries(screenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([screen, count]) => ({ screen, count }));

  return {
    activeUsers: activeSessions.length,
    activeSessions: activeSessions.length,
    topScreens,
    liveConversions,
    liveErrors,
    windowMinutes,
  };
}
