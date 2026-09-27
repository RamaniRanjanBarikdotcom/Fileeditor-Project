// One-off backfill: recover the original generation settings (writingStyle, writingTone,
// targetWordCount, focusKeyword, language, useProductContext, websiteUrl, scraperPlatform)
// for EXISTING blogs that predate gen_params being stored, by reading the generation logs.
//
// How it links a blog to its run: the "Completed generation" log carries the blog_id, so we
// anchor on it (timestamp + the actual generating user), then take the "Starting generation"
// log just before it (which carries the settings). Falls back to the blog's created_at when
// no completed log survives. Best-effort: blogs with no usable log are left for the default
// (their first Generate Again will then store gen_params and be exact thereafter).
//
// Run inside the backend container:
//   docker-compose exec backend node src/scripts/backfill-genparams.js           # dry run
//   docker-compose exec backend node src/scripts/backfill-genparams.js --apply   # write

import '../config/dns-bootstrap.js';
import { connectMongo, getDb, closeMongo } from '../db/mongo.js';

const APPLY = process.argv.includes('--apply');
const WINDOW_MS = 30 * 60 * 1000; // a generation run fits comfortably in 30 min

const toMs = (value) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
};
const parseDetails = (details) => {
  if (!details) return {};
  if (typeof details === 'object') return details;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
const pick = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
};

async function findStartLog(logs, { anchorMs, userId }) {
  const base = {
    category: 'generation',
    timestamp: { $gte: new Date(anchorMs - WINDOW_MS), $lte: new Date(anchorMs) },
  };
  // Prefer the same user as the run; fall back to any user in the window if none match.
  for (const filter of userId != null ? [{ ...base, user_id: userId }, base] : [base]) {
    const rows = await logs.find(filter).sort({ timestamp: -1 }).limit(15).toArray();
    const start = rows.find((l) => /^starting generation/i.test(String(l.message || '')));
    if (start) return start;
  }
  return null;
}

function extractGenParams(startLog, blog) {
  const d = parseDetails(startLog.details);
  const s = d.settings && typeof d.settings === 'object' ? d.settings : {};
  const keywords = pick(d.keywords, s.keywords);
  const writingStyle = pick(d.writingStyle, s.writingStyle, s.writing_style);
  const writingTone = pick(d.writingTone, s.writingTone, s.writing_tone);
  const targetWordCount = pick(d.targetWordCount, s.targetWordCount, s.target_word_count);
  const focusKeyword = pick(d.focusKeyword, s.focusKeyword, s.focus_keyword);
  const language = pick(d.language, s.language, blog.language);
  const useProductContext = pick(d.useProductContext, s.useProductContext, s.use_product_context);
  const websiteUrl = pick(s.websiteUrl, s.website_url, s.siteBaseUrl, s.site_base_url);
  const scraperPlatform = pick(s.scraperPlatform, s.scraper_platform);

  const gp = {};
  if (keywords && (Array.isArray(keywords) ? keywords.length : String(keywords).trim())) {
    gp.keywords = Array.isArray(keywords) ? keywords : String(keywords);
  }
  if (writingStyle) gp.writingStyle = String(writingStyle);
  if (writingTone) gp.writingTone = String(writingTone);
  if (targetWordCount != null && Number(targetWordCount) > 0) gp.targetWordCount = Number(targetWordCount);
  if (focusKeyword) gp.focusKeyword = String(focusKeyword);
  if (language) gp.language = String(language);
  if (typeof useProductContext === 'boolean') gp.useProductContext = useProductContext;
  if (websiteUrl) gp.websiteUrl = String(websiteUrl);
  if (scraperPlatform) gp.scraperPlatform = String(scraperPlatform);
  return gp;
}

async function main() {
  await connectMongo();
  const db = getDb();
  const blogs = db.collection('blogs');
  const logs = db.collection('logs');

  const query = { $or: [{ gen_params: { $exists: false } }, { gen_params: null }, { gen_params: {} }] };
  const total = await blogs.countDocuments(query);
  console.log(`[backfill] ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'} — ${total} blog(s) missing gen_params.\n`);

  let scanned = 0;
  let updated = 0;
  let noStart = 0;
  let noFields = 0;

  const cursor = blogs.find(query);
  while (await cursor.hasNext()) {
    const blog = await cursor.next();
    scanned += 1;
    const blogId = String(blog._id);

    // Anchor on the Completed log (it has blog_id + the generating user), else created_at.
    const completedRows = await logs
      .find({ blog_id: blogId, category: 'generation' })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    const completedLog = completedRows.find((l) => /^completed generation/i.test(String(l.message || '')));
    const anchorMs = completedLog ? toMs(completedLog.timestamp) : toMs(blog.created_at);
    const anchorUser = completedLog ? completedLog.user_id : null;
    if (!Number.isFinite(anchorMs)) {
      noStart += 1;
      continue;
    }

    const startLog = await findStartLog(logs, { anchorMs, userId: anchorUser });
    if (!startLog) {
      noStart += 1;
      continue;
    }

    const genParams = extractGenParams(startLog, blog);
    if (Object.keys(genParams).length === 0) {
      noFields += 1;
      continue;
    }

    if (APPLY) await blogs.updateOne({ _id: blog._id }, { $set: { gen_params: genParams } });
    updated += 1;
    console.log(`${APPLY ? '✓' : '•'} ${blogId} "${String(blog.title || '').slice(0, 50)}" → ${JSON.stringify(genParams)}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Mode:                       ${APPLY ? 'APPLY (wrote changes)' : 'DRY RUN (no writes)'}`);
  console.log(`Blogs missing gen_params:   ${scanned}`);
  console.log(`${APPLY ? 'Recovered + written:' : 'Would recover:'}       ${updated}`);
  console.log(`No matching start-log:      ${noStart}`);
  console.log(`Start-log had no settings:  ${noFields}`);
  console.log(`Left for defaults:          ${scanned - updated}`);
  if (!APPLY) console.log('\nRe-run with --apply to write these.');

  await closeMongo();
}

main().catch(async (err) => {
  console.error('[backfill-genparams] fatal:', err);
  try {
    await closeMongo();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
