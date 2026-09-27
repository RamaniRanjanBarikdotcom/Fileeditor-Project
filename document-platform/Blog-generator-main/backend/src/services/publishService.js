// Publishing + image storage — ported from the `publish-blog`,
// `test-publish-destination`, `upload-image-storage`, `test-image-storage`, and
// WordPress-category ipcMain handlers and their helpers.
//
// Server-side notes vs the desktop app:
//  - There are no local image files on the server, so loadImageBuffer always resolves
//    via the image URL / data-URI path.
//  - "Image storage" is a multipart POST to the user's configured upload endpoint
//    (storage.endpointUrl) — NOT the AWS SDK. Ported faithfully.
//  - Shopify here uses a direct access token on the destination. Full server-side
//    Shopify OAuth (client store + start/callback) is Phase 4b.

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import FormData from 'form-data';
import mime from 'mime-types';

export const PUBLISH_AXIOS_DEFAULTS = {
  timeout: 30000,
  headers: { 'User-Agent': 'AIBlogGenerator/1.0' },
};

/* ------------------------------ small helpers ------------------------------ */

export function normalizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

export function requireHttps(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Endpoint must start with http:// or https://');
  return url;
}

export function ensureValue(label, value) {
  if (!value || !String(value).trim()) throw new Error(`${label} is required`);
  return String(value).trim();
}

export function isPublicHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function normalizeShopDomain(value) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

function countMojibakeMarkers(value) {
  if (!value) return 0;
  const matches = String(value).match(/[ÃÂâÐÑ]/g);
  return matches ? matches.length : 0;
}

export function normalizeUtfText(value) {
  const text = String(value ?? '');
  if (!text) return '';
  if (!/[ÃÂâÐÑ]/.test(text)) return text;
  try {
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    const before = countMojibakeMarkers(text);
    const after = countMojibakeMarkers(repaired);
    if (repaired && after < before && !repaired.includes('�')) return repaired;
  } catch {
    /* keep original */
  }
  return text;
}

export function normalizeImageGallery(gallery, imageUrl = null) {
  let list = [];
  if (Array.isArray(gallery)) {
    list = gallery.filter(Boolean);
  } else if (typeof gallery === 'string') {
    try {
      const parsed = JSON.parse(gallery);
      if (Array.isArray(parsed)) list = parsed.filter(Boolean);
    } catch {
      list = [];
    }
  }
  if (imageUrl && !list.includes(imageUrl)) list.unshift(imageUrl);
  return list;
}

export function parseListInput(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    const raw = value.trim();
    const tryParse = (input) => {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
        if (typeof parsed === 'string' && parsed.trim().startsWith('[')) return tryParse(parsed);
      } catch {
        return null;
      }
      return null;
    };
    const parsed = tryParse(raw);
    if (parsed) return parsed;
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function slugifyFilename(value) {
  const base = String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'image';
}

function buildImageFilename({ title, blogId, mimeType, originalName }) {
  const base = slugifyFilename(title || blogId);
  const extFromMime = mime.extension(mimeType || '') || '';
  const extFromName = originalName && path.extname(originalName).replace('.', '');
  const ext = extFromMime || extFromName || 'jpg';
  return `${base}-${Date.now()}.${ext}`;
}

export function isStorageImageUrl(imageUrl, storage) {
  if (!imageUrl) return false;
  const urlString = String(imageUrl);
  if (urlString.includes('/blog-bild/')) return true;
  if (!storage?.endpointUrl) return false;
  try {
    const imgUrl = new URL(urlString);
    const endpointUrl = new URL(storage.endpointUrl);
    return imgUrl.origin === endpointUrl.origin && imgUrl.pathname.includes('/blog-bild/');
  } catch {
    return false;
  }
}

export function buildShopifyArticleUrl({ shopDomain, blogHandle, articleHandle }) {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain || !blogHandle || !articleHandle) return null;
  return `https://${domain}/blogs/${blogHandle}/${articleHandle}`;
}

export function extractPublishError(error) {
  const status = error?.response?.status;
  const wpMessage = error?.response?.data?.message || error?.response?.data?.error || error?.response?.data?.data?.message || '';
  const generic = error?.message || 'Unknown error';
  if (status === 401) return `Authentication failed (401): ${wpMessage || 'Invalid credentials'}. For WordPress Basic Auth, ensure you are using an Application Password (not your login password). Go to WordPress Admin > Users > Profile > Application Passwords to generate one.`;
  if (status === 403) return `Access forbidden (403): ${wpMessage || 'Insufficient permissions'}. Ensure your WordPress user has Editor or Administrator role. For token auth, verify the token matches exactly what is shown in WordPress Settings > AI Blog Token.`;
  if (status === 404) return `Endpoint not found (404): ${wpMessage || 'The REST API endpoint was not found'}. Verify the site URL is correct and WordPress REST API is enabled. For the token plugin, ensure the AI Blog Endpoint plugin is activated.`;
  if (status === 500 || status === 502 || status === 503) return `Server error (${status}): ${wpMessage || 'The WordPress server encountered an error'}. Check your WordPress error logs for details.`;
  if (error?.code === 'ECONNREFUSED') return 'Connection refused: The server is not reachable. Verify the URL and that the site is online.';
  if (error?.code === 'ENOTFOUND') return 'DNS lookup failed: The domain could not be resolved. Check the URL for typos.';
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'Connection timed out: The server did not respond within 30 seconds. Check if the site is accessible from your network.';
  if (generic.includes('SSL') || generic.includes('certificate') || generic.includes('TLSV1')) return `SSL/TLS error: ${generic}. The site may have an invalid SSL certificate. Ensure HTTPS is properly configured on your WordPress site.`;
  return wpMessage || generic || 'Publish failed';
}

/* ------------------------------ image helpers ------------------------------ */

export async function loadImageBuffer({ imageUrl, localImagePath }) {
  if (localImagePath && fs.existsSync(localImagePath)) {
    const buf = fs.readFileSync(localImagePath);
    const mimeType = mime.lookup(localImagePath) || 'image/jpeg';
    const filename = path.basename(localImagePath) || 'image.jpg';
    return { buffer: buf, mimeType, filename };
  }
  if (!imageUrl) throw new Error('No image source provided');
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(imageUrl)) {
    const match = imageUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) throw new Error('Invalid data URI image');
    const mimeType = match[1] || 'image/jpeg';
    const buffer = Buffer.from(match[2], 'base64');
    const ext = mime.extension(mimeType) || 'jpg';
    return { buffer, mimeType, filename: `image.${ext}` };
  }
  const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(resp.data);
  const mimeType = resp.headers['content-type'] || mime.lookup(imageUrl) || 'image/jpeg';
  const urlPath = new URL(imageUrl).pathname;
  const filenameFromUrl = path.basename(urlPath || '') || 'image.jpg';
  const filename = /\.[a-z0-9]{2,5}$/i.test(filenameFromUrl) ? filenameFromUrl : `${filenameFromUrl}.jpg`;
  return { buffer, mimeType, filename };
}

async function uploadImageViaPlugin({ baseUrl, authHeader, buffer, filename, mimeType, altText }) {
  const uploadEndpoint = `${baseUrl}/wp-json/aiblog/v1/upload`;
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const payload = { url: '', data: dataUri, filename: filename || 'image.jpg', alt: altText || '', title: altText || '', setFeatured: false };
  const res = await axios.post(uploadEndpoint, payload, {
    timeout: PUBLISH_AXIOS_DEFAULTS.timeout,
    headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader, 'Content-Type': 'application/json' },
  });
  return res.data;
}

/** Upload an image to the user's configured storage endpoint (multipart). Returns hosted URL. */
export async function uploadImageToStorage({ blog, imageUrl, localImagePath, storage, filenameBase = '' }) {
  if (!storage?.enabled) return null;
  const endpointUrl = ensureValue('Image storage endpoint', storage.endpointUrl);
  const token = String(storage.authToken || '').trim();
  const img = await loadImageBuffer({ imageUrl, localImagePath });
  const filename = buildImageFilename({ title: filenameBase || blog?.title, blogId: blog?.id, mimeType: img.mimeType, originalName: img.filename });
  const form = new FormData();
  form.append('file', img.buffer, { filename, contentType: img.mimeType || 'image/jpeg' });
  if (blog?.id) form.append('blog_id', String(blog.id));
  if (blog?.title) form.append('title', String(blog.title));
  form.append('base_folder', 'blog-bild');
  if (token) form.append('token', token);

  const headers = { ...PUBLISH_AXIOS_DEFAULTS.headers, ...form.getHeaders() };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await axios.post(endpointUrl, form, { headers, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
  const url = response.data?.url || response.data?.file?.url || response.data?.data?.url || '';
  if (!url) throw new Error('Image storage did not return a URL.');
  return url;
}

/* ------------------------------ WordPress meta ------------------------------ */

export function buildWpAuthHeader(destination) {
  const apiToken = (destination.apiToken || destination.token || destination.authToken || '').trim();
  const username = destination.username?.trim();
  const appPassword = destination.appPassword?.trim();
  if (apiToken) return `Bearer ${apiToken}`;
  if (username && appPassword) return `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
  throw new Error('Provide either an API token (from AI Blog Token plugin) or username + application password');
}

export async function fetchWordpressCategories(destination) {
  const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
  const endpoint = `${baseUrl}/wp-json/aiblog/v1/categories`;
  const authHeader = buildWpAuthHeader(destination);
  const response = await axios.get(endpoint, { headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader }, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
  return Array.isArray(response.data) ? response.data : [];
}

export async function createWordpressCategoryRemote(destination, name) {
  const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
  const endpoint = `${baseUrl}/wp-json/aiblog/v1/categories`;
  const authHeader = buildWpAuthHeader(destination);
  const response = await axios.post(endpoint, { name }, { headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader, 'Content-Type': 'application/json' }, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
  return response.data || { name };
}

export async function fetchShopifyBlogHandle({ shopDomain, accessToken, apiVersion = '2024-01', blogId }) {
  if (!shopDomain || !accessToken || !blogId) return '';
  const domain = normalizeShopDomain(shopDomain);
  const version = (apiVersion || '2024-01').trim();
  try {
    const response = await axios.get(`https://${domain}/admin/api/${version}/blogs/${blogId}.json`, {
      headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken },
      timeout: PUBLISH_AXIOS_DEFAULTS.timeout,
    });
    return response.data?.blog?.handle || '';
  } catch {
    return '';
  }
}

/* ------------------------------ content shaping ------------------------------ */

function insertImageIntoContent(imgSrc, imgAlt, htmlContent) {
  if (!imgSrc) return htmlContent;
  const imageHtml = `<figure class="wp-block-image alignwide"><img src="${imgSrc}" alt="${imgAlt}" class="blog-featured-image" style="width:100%;height:auto;border-radius:8px;margin-bottom:1.5em;" /></figure>\n\n`;
  const h1Match = htmlContent.match(/^(\s*<h1[^>]*>.*?<\/h1>\s*)/i);
  if (h1Match) return h1Match[1] + imageHtml + htmlContent.slice(h1Match[0].length);
  return imageHtml + htmlContent;
}

function stripLeadingH1(htmlContent) {
  if (!htmlContent) return htmlContent;
  return String(htmlContent).replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
}

function stripLeadingTitleFromContent(htmlContent, pageTitle) {
  if (!htmlContent || !pageTitle) return htmlContent;
  const normalizeText = (value) =>
    String(value || '')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedTitle = normalizeText(pageTitle);
  if (!normalizedTitle) return htmlContent;
  const h1Match = htmlContent.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>\s*/i);
  if (h1Match && normalizeText(h1Match[1]) === normalizedTitle) return htmlContent.slice(h1Match[0].length);
  const mdMatch = htmlContent.match(/^\s*#\s+(.+?)(\r?\n)+/);
  if (mdMatch && normalizeText(mdMatch[1]) === normalizedTitle) return htmlContent.slice(mdMatch[0].length);
  const setextMatch = htmlContent.match(/^\s*(.+?)\s*\r?\n=+\s*\r?\n/);
  if (setextMatch && normalizeText(setextMatch[1]) === normalizedTitle) return htmlContent.slice(setextMatch[0].length);
  return htmlContent;
}

function normalizeShopifyTags(items) {
  const raw = (items || []).flatMap((item) => String(item || '').split(/[,;\n]+/));
  const cleaned = raw
    // Keep any Unicode letter/number (so German umlauts ä ö ü ß and other accents survive);
    // only strip punctuation/symbols. The old [^a-zA-Z0-9 _-] pattern deleted all non-ASCII.
    .map((tag) => tag.replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((tag) => (tag.length > 255 ? tag.slice(0, 255) : tag));
  return Array.from(new Set(cleaned));
}

/* ------------------------------ publish dispatch ------------------------------ */

/**
 * Publish a blog to a destination.
 * @param {object} o
 * @param {object} o.destination   the publish destination config
 * @param {object} o.blog          the blog payload
 * @param {string} o.status        'draft' | 'publish'
 * @param {object} o.userSettings  resolved user settings (for imageStorage)
 * @param {function} o.getLatestBlog  async (id) => stored blog | null (for image fallback)
 * @returns {Promise<{result:object, platform:string, publishStatus:string, remotePostId, publishedUrl}>}
 */
export async function publishBlog(o) {
  const { destination, blog, status = 'draft', userSettings = {}, getLatestBlog = async () => null } = o;

  const platform = ensureValue('Platform', destination.platform);
  const publishStatus = status || 'draft';
  const imageGallery = normalizeImageGallery(blog.imageGallery || blog.image_gallery, blog.imageUrl || blog.image_url || null);
  const title = normalizeUtfText(blog.title || 'Untitled');
  const content = normalizeUtfText(blog.content || '');
  const metaDescription = (normalizeUtfText(blog.metaDescription || blog.meta_description || blog?.meta?.description || '') || '').trim();
  let imageUrl = blog.imageUrl || blog.image_url || imageGallery[0] || null;
  let localImagePath = blog.localImagePath || blog.local_image_path || null;
  const keywords = parseListInput(blog.keywords).map((item) => normalizeUtfText(item)).filter(Boolean);
  const categories = parseListInput(blog.categories).map((item) => normalizeUtfText(item)).filter(Boolean);

  let result = null;
  let imageStorageUsed = false;

  // External image storage (best-effort).
  try {
    if (userSettings.imageStorage?.enabled && (imageUrl || localImagePath)) {
      if (isStorageImageUrl(imageUrl, userSettings.imageStorage)) {
        imageStorageUsed = true;
      } else {
        const uploadedUrl = await uploadImageToStorage({ blog, imageUrl, localImagePath, storage: userSettings.imageStorage, filenameBase: blog?.title || title });
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
          localImagePath = null;
          imageStorageUsed = true;
        }
      }
    }
  } catch {
    /* fall back to original image source */
  }

  if (platform === 'wordpress' || platform === 'wordpress-token') {
    if ((!imageUrl || !localImagePath) && blog?.id) {
      try {
        const latest = await getLatestBlog(blog.id);
        if (latest) {
          const latestGallery = normalizeImageGallery(latest.imageGallery || latest.image_gallery, latest.imageUrl || latest.image_url || null);
          imageUrl = imageUrl || latest.image_url || latest.imageUrl || latestGallery[0] || null;
          localImagePath = localImagePath || latest.local_image_path || latest.localImagePath || null;
        }
      } catch {
        /* ignore */
      }
    }

    const baseUrl = requireHttps(normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl)));
    const endpoint = `${baseUrl}/wp-json/aiblog/v1/post`;
    const authHeader = buildWpAuthHeader(destination);

    let imageAsset = null;
    if (imageUrl || localImagePath) {
      try {
        imageAsset = await loadImageBuffer({ imageUrl, localImagePath });
      } catch {
        /* continue without image */
      }
    }

    let mediaUrl = imageUrl;
    const imageAltText = title || keywords?.[0] || '';
    if (imageAsset) {
      try {
        const uploaded = await uploadImageViaPlugin({ baseUrl, authHeader, buffer: imageAsset.buffer, filename: imageAsset.filename, mimeType: imageAsset.mimeType, altText: imageAltText });
        mediaUrl = uploaded.fullUrl || uploaded.url || mediaUrl;
      } catch {
        /* will send inline image data to /post */
      }
    }

    const contentWithImage = stripLeadingTitleFromContent(stripLeadingH1(content), title);
    const postPayload = { title, content: contentWithImage, status: publishStatus, keywords, categories, focusKeyword: keywords[0] || '' };
    if (metaDescription) {
      postPayload.excerpt = metaDescription;
      postPayload.metaDescription = metaDescription;
    }
    if (mediaUrl) postPayload.featuredImage = mediaUrl;
    if (imageAltText) postPayload.featuredImageAlt = imageAltText;
    if (imageAsset) {
      postPayload.featuredImageData = `data:${imageAsset.mimeType};base64,${imageAsset.buffer.toString('base64')}`;
      postPayload.featuredImageName = imageAsset.filename || 'featured-image.jpg';
    }

    const response = await axios.post(endpoint, postPayload, {
      timeout: PUBLISH_AXIOS_DEFAULTS.timeout,
      headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader, 'Content-Type': 'application/json' },
    });
    result = response.data || null;
  } else if (platform === 'shopify') {
    // Direct access token (Phase 4a). Server-side OAuth proxy is Phase 4b.
    const shopDomain = ensureValue('Shopify shop domain', destination.shopDomain);
    const accessToken = ensureValue('Shopify access token', destination.accessToken);
    const blogId = ensureValue('Shopify blog ID', destination.blogId);
    const apiVersion = (destination.apiVersion || '2024-01').trim();
    const blogHandle = destination.blogHandle || (await fetchShopifyBlogHandle({ shopDomain, accessToken, apiVersion, blogId }));

    let mediaUrl = isPublicHttpUrl(imageUrl) ? imageUrl : null;
    if (!imageStorageUsed && (imageUrl || localImagePath)) {
      try {
        const img = await loadImageBuffer({ imageUrl, localImagePath });
        const base64 = img.buffer.toString('base64');
        const fileResponse = await axios.post(
          `https://${shopDomain}/admin/api/${apiVersion}/files.json`,
          { file: { attachment: base64, filename: img.filename || 'blog-image.jpg', mime_type: img.mimeType || 'image/jpeg' } },
          { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
        );
        mediaUrl = fileResponse.data?.file?.url || mediaUrl;
      } catch {
        /* use original URL */
      }
    }

    const contentWithImage = stripLeadingTitleFromContent(stripLeadingH1(content), title);
    const articlePayload = {
      title,
      body_html: contentWithImage,
      tags: normalizeShopifyTags([...keywords, ...categories]).join(', '),
      published: publishStatus === 'publish',
    };
    if (metaDescription) {
      // Keep the human-facing excerpt...
      articlePayload.summary_html = metaDescription;
      // ...but the SEO meta description Shopify renders in <meta name="description">
      // lives in the article's "global.description_tag" metafield, not summary_html.
      articlePayload.metafields = [
        {
          namespace: 'global',
          key: 'description_tag',
          value: metaDescription,
          type: 'single_line_text_field',
        },
      ];
    }
    if (mediaUrl) articlePayload.image = { src: mediaUrl, alt: title || '' };

    const response = await axios.post(
      `https://${shopDomain}/admin/api/${apiVersion}/blogs/${blogId}/articles.json`,
      { article: articlePayload },
      { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );
    const articleHandle = response.data?.article?.handle || '';
    const articleUrl = response.data?.article?.url || buildShopifyArticleUrl({ shopDomain, blogHandle, articleHandle });
    result = { id: response.data?.article?.id, url: articleUrl };
  } else if (platform === 'custom' || platform === 'jtl') {
    const endpointUrl = requireHttps(ensureValue('Endpoint URL', destination.endpointUrl));
    const reqHeaders = { ...PUBLISH_AXIOS_DEFAULTS.headers, 'Content-Type': 'application/json' };
    if (destination.authHeaderName && destination.authHeaderValue) reqHeaders[destination.authHeaderName] = destination.authHeaderValue;
    let extraPayload = {};
    if (destination.extraPayloadJson) {
      const parsed = JSON.parse(destination.extraPayloadJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Extra payload must be a JSON object');
      extraPayload = parsed;
    }
    let contentWithImage = stripLeadingTitleFromContent(stripLeadingH1(content), title);
    if (imageUrl) contentWithImage = insertImageIntoContent(imageUrl, title, contentWithImage);
    const payload = { title, content: contentWithImage, status: publishStatus, keywords, categories, featuredImage: imageUrl, source: 'aibloggenerator', ...extraPayload };
    if (metaDescription) payload.metaDescription = metaDescription;
    const response = await axios.post(endpointUrl, payload, { headers: reqHeaders, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
    result = response.data || null;
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const remotePostId = result?.id ?? result?.postId ?? result?.post_id ?? result?.articleId ?? result?.article?.id ?? null;
  const publishedUrl = result?.url || result?.link || result?.postUrl || result?.post_url || result?.article?.url || null;
  return { result, platform, publishStatus, remotePostId, publishedUrl };
}

/** Connectivity test for a destination (no content published). */
export async function testPublishDestination(destination) {
  const platform = ensureValue('Platform', destination.platform);
  if (platform === 'wordpress' || platform === 'wordpress-token') {
    const baseUrl = normalizeBaseUrl(ensureValue('WordPress site URL', destination.baseUrl));
    const endpoint = `${baseUrl}/wp-json/aiblog/v1/ping`;
    const authHeader = buildWpAuthHeader(destination);
    const response = await axios.get(endpoint, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, Authorization: authHeader } });
    return response.data || { success: true };
  }
  if (platform === 'shopify') {
    const shopDomain = ensureValue('Shopify shop domain', destination.shopDomain);
    const accessToken = ensureValue('Shopify access token', destination.accessToken);
    const apiVersion = (destination.apiVersion || '2024-01').trim();
    const response = await axios.get(`https://${shopDomain}/admin/api/${apiVersion}/shop.json`, { timeout: PUBLISH_AXIOS_DEFAULTS.timeout, headers: { ...PUBLISH_AXIOS_DEFAULTS.headers, 'X-Shopify-Access-Token': accessToken } });
    return { name: response.data?.shop?.name };
  }
  if (platform === 'custom' || platform === 'jtl') {
    const endpointUrl = ensureValue('Endpoint URL', destination.endpointUrl);
    const reqHeaders = { ...PUBLISH_AXIOS_DEFAULTS.headers };
    if (destination.authHeaderName && destination.authHeaderValue) reqHeaders[destination.authHeaderName] = destination.authHeaderValue;
    const response = await axios.post(endpointUrl, { ping: true, source: 'aibloggenerator' }, { headers: reqHeaders, timeout: PUBLISH_AXIOS_DEFAULTS.timeout });
    return response.data || { success: true };
  }
  throw new Error(`Unsupported platform: ${platform}`);
}
