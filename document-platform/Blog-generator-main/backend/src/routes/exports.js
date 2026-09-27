// Export / download / local-image channels. The backend generates file bytes
// (base64); the frontend adapter triggers the browser download / print / file-picker.
import { authed } from './_util.js';
import { getBlogById, getBlogsByIds, getSetting, updateBlog, logActivity, addLog } from '../db/actions.js';
import {
  uploadImageToStorage,
  loadImageBuffer,
  normalizeImageGallery,
} from '../services/publishService.js';
import {
  generateBlogFiles,
  generateBulkZip,
  generateHistoryCsv,
  generateHistoryImagesZip,
} from '../services/fileExporter.js';
import mime from 'mime-types';

function appendToGallery(gallery, imageUrl) {
  const list = normalizeImageGallery(gallery);
  if (imageUrl && !list.includes(imageUrl)) list.unshift(imageUrl);
  return list;
}

async function userSettings(ctx) {
  const raw = await getSetting({ userId: ctx.user.id, key: `user_settings_${ctx.user.id}` });
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export default async function exportRoutes(app) {
  app.post('/api/export-blog', authed(async (ctx, { blogId, blog, formats } = {}) => {
    ctx.requirePermission('export');
    const exportFormats = Array.isArray(formats) ? formats : ['markdown'];
    const ownerId = await ctx.getWorkspaceOwnerId();
    const data = blogId ? await getBlogById(blogId, { userId: ownerId, isAdmin: ctx.isAdmin() }) : blog;
    if (!data) throw new Error('Blog not found');
    const files = await generateBlogFiles(data, exportFormats);
    await logActivity({ userId: ctx.user.id, action: 'export.single', details: `Exported "${data.title}" (${exportFormats.join(', ')})` });
    return { success: true, files };
  }));

  app.post('/api/export-bulk', authed(async (ctx, { blogIds, format } = {}) => {
    ctx.requirePermission('bulkExport');
    const ids = Array.isArray(blogIds) ? blogIds : [];
    if (!ids.length) throw new Error('No blogs selected');
    const ownerId = await ctx.getWorkspaceOwnerId();
    const blogs = await getBlogsByIds(ids, { userId: ownerId, isAdmin: ctx.isAdmin() });
    const zip = await generateBulkZip(blogs, format);
    await logActivity({ userId: ctx.user.id, action: 'export.bulk', details: `Bulk exported ${blogs.length} blogs as ${format}` });
    return { success: true, zip };
  }));

  app.post('/api/export-history-csv', authed(async (ctx, { rows } = {}) => {
    ctx.requirePermission('bulkExport');
    const file = generateHistoryCsv(Array.isArray(rows) ? rows : []);
    await logActivity({ userId: ctx.user.id, action: 'export.historyCsv', details: `Exported history CSV (${(rows || []).length} rows)` });
    return { success: true, file };
  }));

  app.post('/api/export-history-images', authed(async (ctx, { blogIds = [] } = {}) => {
    ctx.requirePermission('bulkExport');
    const ids = (Array.isArray(blogIds) ? blogIds : []).map((id) => String(id || '').trim()).filter(Boolean);
    if (!ids.length) throw new Error('No blogs selected');
    const ownerId = await ctx.getWorkspaceOwnerId();
    const blogs = await getBlogsByIds(ids, { userId: ownerId, isAdmin: ctx.isAdmin() });
    if (!blogs.length) throw new Error('No blogs found for export');
    const zip = await generateHistoryImagesZip(blogs);
    await logActivity({ userId: ctx.user.id, action: 'export.historyImages', details: `Exported history images ZIP (${blogs.length} blogs, ${zip.stats.images} images)` });
    return { success: true, zip, stats: zip.stats };
  }));

  app.post('/api/download-image', authed(async (ctx, { url, title } = {}) => {
    ctx.requirePermission('export');
    if (!url) throw new Error('Image URL required');
    const loaded = await loadImageBuffer({ imageUrl: url, localImagePath: '' });
    const ext = (mime.extension(loaded.mimeType) || 'png').replace(/^jpeg$/, 'jpg');
    const safeTitle = (title || 'image').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'image';
    const name = `${safeTitle.replace(/\s+/g, '-')}.${ext}`;
    await logActivity({ userId: ctx.user.id, action: 'image.download', details: `Downloaded image for "${safeTitle}"` });
    return { success: true, file: { name, mime: loaded.mimeType, base64: loaded.buffer.toString('base64') } };
  }));

  // On the web `localImagePath` arrives as a data-URL produced by the browser file
  // picker (the adapter's select-local-image-file override).
  app.post('/api/attach-local-blog-image', authed(async (ctx, { blogId = null, title = '', localImagePath = '' } = {}) => {
    ctx.requireAnyPermission(['history', 'posts', 'generate']);
    const dataUrl = String(localImagePath || '').trim();
    if (!dataUrl) throw new Error('Image data is required');

    const ownerId = await ctx.getWorkspaceOwnerId();
    const isAdmin = ctx.isAdmin();
    let blog = null;
    if (blogId) blog = await getBlogById(blogId, { userId: ownerId, isAdmin });

    const settings = await userSettings(ctx);
    let finalImageUrl = dataUrl;
    if (settings.imageStorage?.enabled) {
      // Storage is enabled — the uploaded image must be hosted there, not kept as a base64
      // data-URL in the DB. If the upload fails, fail loudly instead of persisting base64.
      try {
        const uploadedUrl = await uploadImageToStorage({
          blog: blog || { id: blogId, title },
          imageUrl: dataUrl,
          localImagePath: '',
          storage: settings.imageStorage,
          filenameBase: title || blog?.title || 'blog-image',
        });
        if (!uploadedUrl) throw new Error('Image storage did not return a URL');
        finalImageUrl = uploadedUrl;
      } catch (uploadErr) {
        throw new Error(`Image storage upload failed (${uploadErr.message}). Check the image storage endpoint/token in Settings.`);
      }
    }

    let updatedBlog = null;
    if (blogId && blog) {
      const existingGallery = normalizeImageGallery(blog.imageGallery || blog.image_gallery, blog.imageUrl || blog.image_url);
      updatedBlog = { ...blog, imageUrl: finalImageUrl, imageGallery: appendToGallery(existingGallery, finalImageUrl), localImagePath: '' };
      await updateBlog({ blog: updatedBlog, userId: ownerId, isAdmin });
    }

    await addLog({
      level: 'info',
      category: 'image',
      message: `Attached local image${title ? ` for "${title}"` : ''}`,
      details: { blogId: blogId || null, blogTitle: title || blog?.title || '', source: 'local-upload', uploadedToStorage: finalImageUrl !== dataUrl },
      blogId: blogId || null,
      tokensUsed: 0,
      cost: 0,
      userId: ctx.user.id,
    });

    return { success: true, imageUrl: finalImageUrl, localPath: '', imageGallery: updatedBlog?.imageGallery || null, blog: updatedBlog };
  }));
}
