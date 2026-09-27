// Scheduler runner (worker process). Polls due jobs across ALL users and executes
// them server-side — the web equivalent of the desktop's processSchedulerJob, but
// calling the generation/publish services directly instead of via a renderer.
//
// Each job carries its workspace-owner user_id; we resolve that user's settings, API
// keys, products, and destinations to run generation + publishing in their context.

import { createRequire } from 'node:module';
import {
  getSetting,
  getBlogById,
  recordPublishHistory,
} from '../db/actions.js';
import {
  listDueJobs,
  listStaleRunningJobs,
  setJobStatus,
  addWorkerLog,
} from '../services/schedulerService.js';
import { generateBlog, generateBlogImage } from '../services/blogGenerator.js';
import {
  publishBlog,
  uploadImageToStorage,
  normalizeImageGallery,
  normalizeUtfText,
  parseListInput,
} from '../services/publishService.js';
import { getPublishDestination } from '../lib/context.js';
import { getAccessToken as getShopifyAccessToken } from '../services/shopifyOauth.js';
import { publishSchedulerEvent } from '../realtime/pubsub.js';

const require = createRequire(import.meta.url);
const ProductScraper = require('../services/productScraper.cjs');

const POLL_INTERVAL_MS = Number(process.env.SCHEDULER_POLL_INTERVAL_MS || 30000);
const RUNNING_STALE_MS = Number(process.env.SCHEDULER_RUNNING_STALE_MS || 15 * 60 * 1000);

let tickInProgress = false;

function safeParse(raw) {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function makeGetProviderApiKey(userId, mergedSettings) {
  return async (providerId) => {
    let key = null;
    if (Array.isArray(mergedSettings.apiKeys)) {
      const pk = mergedSettings.apiKeys.filter((i) => (i.provider || 'openai') === providerId);
      const active = pk.find((i) => i.isActive) || pk[0];
      if (active?.key) key = active.key;
    }
    if (!key && providerId === 'openai') key = await getSetting({ userId, key: `api_key_${userId}` });
    return key;
  };
}

async function loadProducts(job, ownerId) {
  // Match the desktop: when product context + a website are set, scrape live; otherwise
  // fall back to the saved product database for the workspace.
  if (job.useProductContext && job.websiteUrl) {
    const platform = String(job.scraperPlatform || 'generic').toLowerCase();
    let products = await ProductScraper.productScrapper(job.websiteUrl, { platform, mode: 'static' }).catch(() => []);
    if (!Array.isArray(products) || products.length === 0) {
      products = await ProductScraper.productScrapper(job.websiteUrl, { platform, mode: 'dynamic' }).catch(() => []);
    }
    if (Array.isArray(products) && products.length > 0) return products;
  }
  const raw = await getSetting({ userId: ownerId, key: `product_database_${ownerId}` });
  const parsed = safeParse(raw);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.products) ? parsed.products : [];
}

async function processJob(job) {
  const ownerId = String(job.userId || '');
  if (!ownerId) throw new Error('Scheduler job is missing its owner user_id');
  const user = { id: ownerId };

  await setJobStatus(job.id, 'running');
  publishSchedulerEvent({ userId: ownerId, jobId: job.id, status: 'running' });
  await addWorkerLog({
    userId: ownerId,
    jobId: job.id,
    shopId: job.destinationId || '',
    status: 'info',
    message: `Started processing schedule "${job.topic || 'Untitled'}"`,
    meta: { runAt: job.runAt, autoPost: !!job.autoPost, generateImage: !!job.generateImage, scheduleMode: job.scheduleMode },
  });

  const storedSettings = safeParse(await getSetting({ userId: ownerId, key: `user_settings_${ownerId}` }));
  let blog = null;
  let publishedUrl = '';

  try {
    if (job.scheduleMode === 'existing' || job.sourceBlogId) {
      if (!job.sourceBlogId) throw new Error('Source history blog is required for existing-blog schedule mode');
      blog = await getBlogById(job.sourceBlogId, { userId: ownerId, isAdmin: false });
      if (!blog) throw new Error('Selected history blog was not found');
    } else {
      const mergedSettings = {
        aiProvider: 'openai',
        imageProvider: 'openai',
        aiModel: 'gpt-4o',
        imageModel: 'gpt-image-1',
        maxTokens: null,
        serpProvider: 'openai',
        deepResearchProvider: 'openai',
        deepResearchModel: 'gpt-4o-mini',
        ...storedSettings,
        autoSave: true,
        language: job.language || 'English',
        focusKeyword: job.focusKeyword || '',
        writingStyle: job.writingStyle || 'professional',
        writingTone: job.writingTone || 'friendly',
        targetWordCount: job.targetWordCount || 2500,
        useProductContext: !!job.useProductContext,
        siteBaseUrl: job.websiteUrl || '',
        websiteUrl: job.websiteUrl || '',
        scraperPlatform: job.scraperPlatform || 'generic',
      };
      const products = mergedSettings.useProductContext ? await loadProducts(job, ownerId) : [];
      // Prefer the publishing destination's site for brand/site context; fall back to the
      // job's website link (handled inside generateBlog via siteBaseUrl).
      let destinationUrl = '';
      if (job.destinationId) {
        try {
          const dest = await getPublishDestination(job.destinationId, ownerId);
          if (dest) {
            destinationUrl =
              dest.platform === 'shopify' && dest.shopDomain
                ? `https://${String(dest.shopDomain).replace(/^https?:\/\//, '')}`
                : dest.baseUrl || '';
          }
        } catch (_destErr) {
          /* non-fatal: fall back to the job website link */
        }
      }
      const result = await generateBlog({
        topic: job.topic,
        keywords: job.keywords,
        categories: job.categories,
        settings: mergedSettings,
        mergedSettings,
        user,
        ownerId,
        products,
        destinationUrl,
        getProviderApiKey: makeGetProviderApiKey(ownerId, mergedSettings),
        onProgress: () => {},
      });
      if (!result?.success || !result.blog) throw new Error(result?.error || 'Blog generation failed');
      blog = result.blog;
    }

    // Re-load the saved snapshot so publishing follows the same data path as manual posting.
    if (blog?.id) {
      const latest = await getBlogById(blog.id, { userId: ownerId, isAdmin: false }).catch(() => null);
      if (latest) blog = { ...latest, id: latest.id || blog.id, metaDescription: latest.metaDescription || latest.meta_description || blog.metaDescription || '' };
    }

    if (blog) {
      const gallery = normalizeImageGallery(blog.imageGallery || blog.image_gallery, blog.imageUrl || blog.image_url || null);
      blog = {
        ...blog,
        title: normalizeUtfText(blog.title || job.topic || ''),
        content: normalizeUtfText(blog.content || ''),
        metaDescription: normalizeUtfText(blog.metaDescription || blog.meta_description || ''),
        keywords: parseListInput(blog.keywords).map((i) => normalizeUtfText(i)).filter(Boolean),
        categories: parseListInput(blog.categories).map((i) => normalizeUtfText(i)).filter(Boolean),
        imageGallery: gallery,
        imageUrl: String(blog.imageUrl || blog.image_url || gallery[0] || '').trim(),
        localImagePath: String(blog.localImagePath || blog.local_image_path || '').trim(),
      };
    }

    if (job.generateImage && blog?.id) {
      const mergedImageSettings = { aiProvider: 'openai', imageProvider: 'openai', imageModel: 'gpt-image-1', ...storedSettings };
      const imageResult = await generateBlogImage({
        blogId: blog.id,
        title: blog.title || job.topic,
        content: blog.content || '',
        mergedSettings: mergedImageSettings,
        storedSettings,
        user,
        ownerId,
        isAdmin: false,
        getProviderApiKey: makeGetProviderApiKey(ownerId, mergedImageSettings),
        uploadStorage: uploadImageToStorage,
      }).catch((err) => ({ success: false, error: err.message }));
      if (imageResult?.success) {
        blog = imageResult.blog || { ...blog, imageUrl: imageResult.imageUrl || blog.imageUrl || '' };
      } else {
        await addWorkerLog({ userId: ownerId, jobId: job.id, shopId: job.destinationId || '', status: 'warning', message: 'Image generation failed for schedule job', meta: { error: imageResult?.error || 'Unknown image error' } });
      }
    }

    if (job.autoPost) {
      if (!job.destinationId) throw new Error('Destination is required for auto post');
      let destination = await getPublishDestination(job.destinationId, ownerId);
      if (!destination) throw new Error(`Destination not found: ${job.destinationId}`);

      const mergedKeywords = Array.from(new Set([...parseListInput(blog?.keywords), ...parseListInput(job?.keywords), ...(job?.focusKeyword ? [job.focusKeyword] : [])]));
      const mergedCategories = Array.from(new Set([...parseListInput(blog?.categories), ...(Array.isArray(job?.categories) ? job.categories : [])]));
      blog = { ...blog, keywords: mergedKeywords, categories: mergedCategories, metaDescription: blog?.metaDescription || blog?.meta_description || '' };

      if (destination.platform === 'shopify' && !destination.accessToken && destination.shopDomain) {
        const at = await getShopifyAccessToken(ownerId, destination.shopDomain, destination.id || '');
        destination = { ...destination, accessToken: at };
      }

      const pub = await publishBlog({
        destination,
        blog,
        status: job.publishStatus || 'draft',
        userSettings: storedSettings,
        getLatestBlog: (id) => getBlogById(id, { userId: ownerId, isAdmin: false }),
      });
      await recordPublishHistory({
        blogId: blog.id || null,
        remotePostId: pub.remotePostId,
        destinationId: destination.id || null,
        destinationName: destination.name || pub.platform,
        platform: pub.platform,
        status: pub.publishStatus,
        publishedUrl: pub.publishedUrl,
        userId: ownerId,
      });
      publishedUrl = pub.publishedUrl || '';
    }

    await setJobStatus(job.id, 'completed');
    publishSchedulerEvent({ userId: ownerId, jobId: job.id, status: 'completed' });
    await addWorkerLog({
      userId: ownerId,
      jobId: job.id,
      shopId: job.destinationId || '',
      status: 'success',
      message: job.autoPost ? 'Schedule job completed and posted' : 'Schedule job completed',
      publishedUrl,
      meta: { blogId: String(blog?.id || ''), publishedUrl, scheduleMode: job.scheduleMode, sourceBlogId: job.sourceBlogId || '' },
    });
  } catch (error) {
    const message = error?.message || 'Scheduler job failed';
    await setJobStatus(job.id, 'failed');
    publishSchedulerEvent({ userId: ownerId, jobId: job.id, status: 'failed' });
    await addWorkerLog({ userId: ownerId, jobId: job.id, shopId: job.destinationId || '', status: 'error', message: `Schedule job failed: ${message}`, meta: { error: message } });
  }
}

export async function runSchedulerTick(trigger = 'timer') {
  if (tickInProgress) return;
  tickInProgress = true;
  try {
    // Recover jobs stuck in "running" beyond the stale window.
    for (const stale of await listStaleRunningJobs(RUNNING_STALE_MS)) {
      await setJobStatus(stale.id, 'failed');
      publishSchedulerEvent({ userId: stale.userId, jobId: stale.id, status: 'failed' });
      await addWorkerLog({ userId: stale.userId, jobId: stale.id, shopId: stale.destinationId || '', status: 'warning', message: 'Scheduler job marked failed after stale running timeout', meta: { timeoutMs: RUNNING_STALE_MS } });
    }

    const due = await listDueJobs(1000);
    if (due.length === 0) return;
    console.log(`[Scheduler] ${trigger}: processing ${due.length} due job(s)`);
    for (const job of due) {
      try {
        await processJob(job);
      } catch (err) {
        console.error(`[Scheduler] Job ${job.id} failed:`, err?.message || err);
      }
    }
  } catch (err) {
    console.warn('[Scheduler] Tick failed:', err?.message || err);
  } finally {
    tickInProgress = false;
  }
}

export function startSchedulerRunner() {
  console.log(`[Scheduler] Runner started (poll every ${POLL_INTERVAL_MS}ms)`);
  setInterval(() => void runSchedulerTick('interval'), POLL_INTERVAL_MS);
  setTimeout(() => void runSchedulerTick('startup'), 2000);
}
