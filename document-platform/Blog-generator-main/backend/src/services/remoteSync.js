// Remote-post sync — ports the WordPress/Shopify sync, detail, edit, delete, and
// stats handlers from src/main/index.js. The read side (listing remote posts) lives
// in db/actions.js already; this is the fetch-from-provider + upsert side.
//
// Note: the desktop's get-remote-post-detail had a large best-effort fallback that
// matched remote posts to local blogs via publish history + URL/title heuristics. Here
// we resolve the linked local blog via the direct publish_history → blogs lookup
// (getBlogForRemotePost); the heavier heuristic matching is intentionally omitted.

import axios from 'axios';
import {
  PUBLISH_AXIOS_DEFAULTS,
  ensureValue,
  requireHttps,
  normalizeBaseUrl,
  normalizeShopDomain,
  normalizeUtfText,
  isPublicHttpUrl,
  extractPublishError,
  buildWpAuthHeader,
  buildShopifyArticleUrl,
  fetchShopifyBlogHandle,
} from './publishService.js';
import {
  replaceRemotePosts,
  upsertRemotePosts,
  deleteRemotePost as deleteRemotePostRecord,
  getBlogForRemotePost,
  updatePublishHistoryStatusByRemotePost,
} from '../db/actions.js';

const WP_STATS_CACHE_MS = 60 * 1000;
const wpStatsCache = new Map();

/* ------------------------------ WordPress HTTP ------------------------------ */

async function fetchWordpressPosts({ baseUrl, token, authType = 'bearer', perPage = 50, after = null }) {
  const normalizedUrl = requireHttps(normalizeBaseUrl(baseUrl));
  const endpoint = `${normalizedUrl}/wp-json/aiblog/v1/posts`;
  const authHeader = authType === 'basic' ? `Basic ${token}` : `Bearer ${token}`;
  const params = { per_page: perPage };
  if (after) params.after = after;
  try {
    const response = await axios.get(endpoint, { headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader }, params, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
    return response.data;
  } catch (error) {
    throw new Error(extractPublishError(error));
  }
}

async function fetchWordpressPostDetail({ destination, postId, timeoutMs = PUBLISH_AXIOS_DEFAULTS.timeout }) {
  const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
  const authHeader = buildWpAuthHeader(destination);
  const endpoint = `${baseUrl}/wp-json/aiblog/v1/post/${postId}`;
  const response = await axios.get(endpoint, { timeout: timeoutMs, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader } });
  return response.data;
}

async function updateWordpressPost({ destination, postId, title, content, status, excerpt, featuredImage, featuredImageAlt }) {
  const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
  const authHeader = buildWpAuthHeader(destination);
  const endpoint = `${baseUrl}/wp-json/aiblog/v1/post`;
  const payload = { id: postId, title, content, status, excerpt };
  if (featuredImage) payload.featuredImage = featuredImage;
  if (featuredImageAlt) payload.featuredImageAlt = featuredImageAlt;
  const response = await axios.post(endpoint, payload, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader } });
  return response.data;
}

async function deleteWordpressPost({ destination, postId, force = false }) {
  const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
  const authHeader = buildWpAuthHeader(destination);
  const endpoint = `${baseUrl}/wp-json/aiblog/v1/post/${postId}`;
  const response = await axios.delete(endpoint, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader }, params: force ? { force: true } : undefined });
  return response.data;
}

export async function getWordpressStats(destination) {
  const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
  const cacheKey = `${destination.id || 'default'}|${baseUrl}`;
  const cached = wpStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WP_STATS_CACHE_MS) return cached.data;
  const endpoint = `${baseUrl}/wp-json/aiblog/v1/site`;
  const authHeader = buildWpAuthHeader(destination);
  const res = await axios.get(endpoint, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader } });
  const postCounts = res.data?.postCounts || {};
  const data = {
    total: Object.values(postCounts).reduce((sum, v) => sum + Number(v || 0), 0),
    published: Number(postCounts.publish || 0),
    draft: Number(postCounts.draft || 0),
    pending: Number(postCounts.pending || 0),
    scheduled: Number(postCounts.future || 0),
    private: Number(postCounts.private || 0),
    trash: Number(postCounts.trash || 0),
    raw: postCounts,
  };
  wpStatsCache.set(cacheKey, { ts: Date.now(), data });
  return data;
}

/* ------------------------------ Shopify HTTP ------------------------------ */

async function fetchShopifyPosts({ shopDomain, accessToken, apiVersion = '2024-01', blogId, limit = 100 }) {
  const domain = normalizeShopDomain(shopDomain);
  const version = (apiVersion || '2024-01').trim();
  const endpoint = `https://${domain}/admin/api/${version}/blogs/${blogId}/articles.json`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get(endpoint, { headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken }, params: { limit }, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
      return Array.isArray(response.data?.articles) ? response.data.articles : [];
    } catch (error) {
      const status = error.response?.status;
      if (status === 429 && attempt < 2) {
        const retryAfter = Number(error.response?.headers?.['retry-after'] || 2);
        await sleep(Math.max(1, retryAfter) * 1000);
        continue;
      }
      throw new Error(extractPublishError(error));
    }
  }
  throw new Error('Shopify sync failed after retries');
}

async function fetchShopifyArticleDetail({ shopDomain, accessToken, apiVersion = '2024-01', blogId, articleId, timeoutMs = PUBLISH_AXIOS_DEFAULTS.timeout }) {
  const domain = normalizeShopDomain(shopDomain);
  const version = (apiVersion || '2024-01').trim();
  const endpoint = `https://${domain}/admin/api/${version}/blogs/${blogId}/articles/${articleId}.json`;
  const response = await axios.get(endpoint, { timeout: timeoutMs, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken } });
  return response.data?.article || null;
}

async function updateShopifyArticle({ shopDomain, accessToken, apiVersion = '2024-01', blogId, articleId, title, bodyHtml, summaryHtml, tags, status, imageSrc }) {
  const domain = normalizeShopDomain(shopDomain);
  const version = (apiVersion || '2024-01').trim();
  const endpoint = `https://${domain}/admin/api/${version}/blogs/${blogId}/articles/${articleId}.json`;
  const articlePayload = { id: articleId, title, body_html: bodyHtml, summary_html: summaryHtml, tags, published: status === 'publish' };
  if (imageSrc) articlePayload.image = { src: imageSrc, alt: title || '' };
  const response = await axios.put(endpoint, { article: articlePayload }, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } });
  return response.data?.article || null;
}

async function deleteShopifyArticle({ shopDomain, accessToken, apiVersion = '2024-01', blogId, articleId }) {
  const domain = normalizeShopDomain(shopDomain);
  const version = (apiVersion || '2024-01').trim();
  const endpoint = `https://${domain}/admin/api/${version}/blogs/${blogId}/articles/${articleId}.json`;
  await axios.delete(endpoint, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken } });
  return { success: true };
}

/* ------------------------------ orchestration ------------------------------ */

function wpAuthFromDestination(destination) {
  if (destination.apiToken?.trim()) return { token: destination.apiToken.trim(), authType: 'bearer' };
  if (destination.token?.trim()) return { token: destination.token.trim(), authType: 'bearer' };
  if (destination.authToken?.trim()) return { token: destination.authToken.trim(), authType: 'bearer' };
  if (destination.username?.trim() && destination.appPassword?.trim()) {
    return { token: Buffer.from(`${destination.username.trim()}:${destination.appPassword.trim()}`).toString('base64'), authType: 'basic' };
  }
  return { token: null, authType: 'bearer' };
}

async function bumpHistory(items, destinationId, statusOf) {
  try {
    await Promise.all(items.map((item) => updatePublishHistoryStatusByRemotePost({ remotePostId: item.id, destinationId, status: statusOf(item) })));
  } catch {
    /* ignore */
  }
}

export async function syncRemotePosts({ destination, after = null }) {
  const platform = destination.platform;

  if (platform === 'wordpress' || platform === 'wordpress-token') {
    if (!destination.baseUrl) throw new Error('Destination baseUrl is missing. Please check your WordPress settings.');
    const { token, authType } = wpAuthFromDestination(destination);
    if (!token) throw new Error('API token or credentials missing for destination');
    const data = await fetchWordpressPosts({ baseUrl: destination.baseUrl, token, authType, after });
    const posts = Array.isArray(data.items) ? data.items : [];
    await replaceRemotePosts(
      posts.map((item) => ({
        id: item.id,
        destination_id: destination.id || null,
        title: typeof item.title === 'string' ? item.title : item.title?.rendered || 'Untitled',
        status: item.status,
        url: item.url || item.link,
        created_at: item.created_at || item.date,
        updated_at: item.updated_at || item.modified,
        published_at: item.status === 'publish' ? item.created_at || item.date : null,
        views: typeof item.views === 'number' ? item.views : null,
        last_viewed: item.last_viewed || null,
        time_spent: typeof item.timeSpent === 'number' ? item.timeSpent : null,
        topics: [...(item.tags || []), ...(item.categories || [])],
      })),
      'wordpress',
      destination.id || null
    );
    await bumpHistory(posts, destination.id || null, (item) => String(item.status || 'draft').toLowerCase());
    return { count: posts.length };
  }

  if (platform === 'shopify') {
    const shopDomain = ensureValue('Shopify shop domain', destination.shopDomain);
    const accessToken = ensureValue('Shopify access token', destination.accessToken);
    const blogId = ensureValue('Shopify blog ID', destination.blogId);
    const apiVersion = (destination.apiVersion || '2024-01').trim();
    const articles = await fetchShopifyPosts({ shopDomain, accessToken, apiVersion, blogId });
    const blogHandle = destination.blogHandle || (await fetchShopifyBlogHandle({ shopDomain, accessToken, apiVersion, blogId }));
    await replaceRemotePosts(
      articles.map((item) => {
        const candidateUrl = item.url || '';
        const articleUrl = isPublicHttpUrl(candidateUrl) ? candidateUrl : buildShopifyArticleUrl({ shopDomain, blogHandle, articleHandle: item.handle || '' });
        return {
          id: item.id,
          destination_id: destination.id || null,
          title: item.title || 'Untitled',
          status: item.published_at ? 'publish' : 'draft',
          url: articleUrl || null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          published_at: item.published_at,
          views: null,
          last_viewed: null,
          time_spent: null,
          topics: Array.isArray(item.tags) ? item.tags : String(item.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        };
      }),
      'shopify',
      destination.id || null
    );
    await bumpHistory(articles, destination.id || null, (item) => (item.published_at ? 'publish' : 'draft'));
    return { count: articles.length };
  }

  throw new Error('Sync only works with WordPress or Shopify destinations');
}

export async function getRemotePostDetail({ destination, postId, resolveLinkedImages = false }) {
  let localBlog = null;
  if (resolveLinkedImages) {
    localBlog = await getBlogForRemotePost({ remotePostId: postId, destinationId: destination.id || null }).catch(() => null);
  }
  const resolvedGallery = Array.isArray(localBlog?.imageGallery) ? localBlog.imageGallery : Array.isArray(localBlog?.image_gallery) ? localBlog.image_gallery : [];
  const resolvedFeatured = localBlog?.imageUrl || localBlog?.image_url || '';

  if (destination.platform === 'shopify') {
    const shopDomain = ensureValue('Shopify shop domain', destination.shopDomain);
    const accessToken = ensureValue('Shopify access token', destination.accessToken);
    const blogId = ensureValue('Shopify blog ID', destination.blogId);
    const apiVersion = (destination.apiVersion || '2024-01').trim();
    const article = await fetchShopifyArticleDetail({ shopDomain, accessToken, apiVersion, blogId, articleId: postId, timeoutMs: 10000 });
    if (!article) throw new Error('Shopify article not found');
    const blogHandle = destination.blogHandle || (await fetchShopifyBlogHandle({ shopDomain, accessToken, apiVersion, blogId }));
    const articleUrl = isPublicHttpUrl(article.url || '') ? article.url : buildShopifyArticleUrl({ shopDomain, blogHandle, articleHandle: article.handle || '' });
    return {
      post: {
        id: article.id,
        title: article.title || '',
        content: article.body_html || '',
        summary: article.summary_html || '',
        status: article.published_at ? 'publish' : 'draft',
        url: articleUrl || null,
        tags: article.tags || '',
        featuredImage: article.image?.src || '',
        imageGallery: resolvedGallery,
        localImageUrl: resolvedFeatured || '',
        provider: 'shopify',
      },
    };
  }

  const data = await fetchWordpressPostDetail({ destination, postId, timeoutMs: 10000 });
  const remoteTitle = normalizeUtfText(typeof data?.title === 'string' ? data.title : data?.title?.rendered || '') || '';
  const remoteFeaturedImage = String(data?.featuredImage || data?.featured_image || data?.image?.src || data?._embedded?.['wp:featuredmedia']?.[0]?.source_url || '').trim();
  const content = normalizeUtfText(typeof data?.rawContent === 'string' ? data.rawContent : typeof data?.content === 'string' ? data.content : data?.content?.rendered || '');
  const summary = normalizeUtfText(typeof data?.excerpt === 'string' ? data.excerpt : data?.excerpt?.rendered || '');
  return {
    post: {
      id: data.id || postId,
      title: remoteTitle,
      content,
      summary,
      status: data.status || 'draft',
      url: data.url || data.link || null,
      tags: Array.isArray(data.tags) ? data.tags.map((tag) => normalizeUtfText(tag)) : [],
      featuredImage: remoteFeaturedImage,
      imageGallery: resolvedGallery,
      localImageUrl: resolvedFeatured || '',
      provider: 'wordpress',
    },
  };
}

export async function updateRemotePost({ destination, postId, title, content, status, imageUrl }) {
  const normalizedTitle = normalizeUtfText(title || '');
  const normalizedContent = normalizeUtfText(content || '');

  if (destination.platform === 'shopify') {
    const shopDomain = ensureValue('Shopify shop domain', destination.shopDomain);
    const accessToken = ensureValue('Shopify access token', destination.accessToken);
    const blogId = ensureValue('Shopify blog ID', destination.blogId);
    const apiVersion = (destination.apiVersion || '2024-01').trim();
    const current = await fetchShopifyArticleDetail({ shopDomain, accessToken, apiVersion, blogId, articleId: postId });
    if (!current) throw new Error('Shopify article not found');
    const updated = await updateShopifyArticle({ shopDomain, accessToken, apiVersion, blogId, articleId: postId, title: normalizedTitle, bodyHtml: normalizedContent, summaryHtml: current.summary_html || '', tags: current.tags || '', status, imageSrc: imageUrl || '' });
    const nextStatus = updated?.published_at ? 'publish' : 'draft';
    const blogHandle = destination.blogHandle || (await fetchShopifyBlogHandle({ shopDomain, accessToken, apiVersion, blogId }));
    const articleUrl = isPublicHttpUrl(updated?.url || '') ? updated.url : buildShopifyArticleUrl({ shopDomain, blogHandle, articleHandle: updated?.handle || current.handle || '' });
    await upsertRemotePosts(
      [{
        id: updated?.id || postId,
        destination_id: destination.id || null,
        title: updated?.title || normalizedTitle || 'Untitled',
        status: nextStatus,
        url: articleUrl || null,
        created_at: updated?.created_at || current?.created_at,
        updated_at: updated?.updated_at || new Date().toISOString(),
        published_at: updated?.published_at || null,
        views: null,
        last_viewed: null,
        time_spent: null,
        topics: Array.isArray(updated?.tags) ? updated.tags : String(updated?.tags || current?.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      }],
      'shopify'
    );
    await updatePublishHistoryStatusByRemotePost({ remotePostId: updated?.id || postId, destinationId: destination.id || null, status: nextStatus }).catch(() => {});
    return { postId };
  }

  const updated = await updateWordpressPost({ destination, postId, title: normalizedTitle, content: normalizedContent, status, excerpt: '', featuredImage: imageUrl || '', featuredImageAlt: normalizedTitle || '' });
  await upsertRemotePosts(
    [{
      id: updated.id || postId,
      destination_id: destination.id || null,
      title: updated.title || updated?.title?.rendered || normalizedTitle || 'Untitled',
      status: updated.status || status || 'draft',
      url: updated.url || updated.link,
      created_at: updated.created_at || updated.date,
      updated_at: updated.updated_at || updated.modified,
      published_at: updated.status === 'publish' ? updated.created_at || updated.date : null,
      views: typeof updated.views === 'number' ? updated.views : null,
      last_viewed: updated.last_viewed || null,
      time_spent: typeof updated.timeSpent === 'number' ? updated.timeSpent : null,
      topics: [...(updated.tags || []), ...(updated.categories || [])],
    }],
    'wordpress'
  );
  await updatePublishHistoryStatusByRemotePost({ remotePostId: updated.id || postId, destinationId: destination.id || null, status: updated.status || status || 'draft' }).catch(() => {});
  return { postId };
}

export async function deleteRemotePost({ destination, postId, force = false }) {
  if (destination.platform === 'shopify') {
    const shopDomain = ensureValue('Shopify shop domain', destination.shopDomain);
    const accessToken = ensureValue('Shopify access token', destination.accessToken);
    const blogId = ensureValue('Shopify blog ID', destination.blogId);
    const apiVersion = (destination.apiVersion || '2024-01').trim();
    await deleteShopifyArticle({ shopDomain, accessToken, apiVersion, blogId, articleId: postId });
    await deleteRemotePostRecord({ id: postId, provider: 'shopify', destinationId: destination.id || null });
    // Mark the publish-history status 'deleted' so the History page moves the blog out of
    // Published/Draft (it maps 'deleted' → non-posted) instead of keeping a stale badge.
    await updatePublishHistoryStatusByRemotePost({ remotePostId: postId, destinationId: destination.id || null, status: 'deleted' }).catch(() => {});
    return {};
  }
  await deleteWordpressPost({ destination, postId, force });
  await deleteRemotePostRecord({ id: postId, provider: 'wordpress', destinationId: destination.id || null });
  await updatePublishHistoryStatusByRemotePost({ remotePostId: postId, destinationId: destination.id || null, status: 'deleted' }).catch(() => {});
  return {};
}

export async function testWordpressSync(destination) {
  const result = {
    destination: {
      name: destination.name,
      platform: destination.platform,
      baseUrl: destination.baseUrl,
      hasApiToken: !!destination.apiToken?.trim(),
      hasUsername: !!destination.username?.trim(),
      hasAppPassword: !!destination.appPassword?.trim(),
    },
    tests: [],
  };
  if (!destination.baseUrl) return { ok: false, error: 'No baseUrl configured', result };
  const { token, authType } = wpAuthFromDestination(destination);
  if (!token) return { ok: false, error: 'No authentication credentials found', result };

  const normalizedUrl = requireHttps(normalizeBaseUrl(destination.baseUrl));
  const authHeader = authType === 'basic' ? `Basic ${token}` : `Bearer ${token}`;

  try {
    const wpApiTest = await axios.get(`${normalizedUrl}/wp-json/`, { timeout: 10000 });
    result.tests.push({ name: 'WordPress REST API', endpoint: `${normalizedUrl}/wp-json/`, success: true, status: wpApiTest.status, siteName: wpApiTest.data?.name });
  } catch (e) {
    result.tests.push({ name: 'WordPress REST API', endpoint: `${normalizedUrl}/wp-json/`, success: false, error: e.message, status: e.response?.status });
  }
  try {
    const pluginTest = await axios.get(`${normalizedUrl}/wp-json/aiblog/v1/posts`, { headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader }, params: { per_page: 1 }, timeout: 10000 });
    result.tests.push({ name: 'AI Blog plugin (/posts)', success: true, status: pluginTest.status, total: pluginTest.data?.total ?? null });
  } catch (e) {
    result.tests.push({ name: 'AI Blog plugin (/posts)', success: false, error: extractPublishError(e), status: e.response?.status });
  }
  const ok = result.tests.every((t) => t.success);
  return { ok, result };
}
