// Shopify OAuth + blog channels (server-side). The browser-facing callback is a
// public GET; everything else is an authenticated POST channel.
import { authed } from './_util.js';
import {
  listClients,
  saveClient,
  deleteClient,
  startOauth,
  getStatus,
  completeCallback,
  listBlogs,
  createBlog,
} from '../services/shopifyOauth.js';

function renderCallbackPage({ title, message, autoClose }) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const closeScript = autoClose
    ? '<script>setTimeout(function(){try{window.open("","_self");window.close();}catch(e){}},700);</script>'
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>` +
    `<body style="font-family:system-ui,sans-serif;padding:48px;text-align:center">` +
    `<h2>${esc(title)}</h2><p>${esc(message)}</p>` +
    `<p style="color:#888">You can close this window.</p>${closeScript}</body></html>`;
}

export default async function shopifyRoutes(app) {
  // 1) Public OAuth callback — Shopify redirects the browser here (no app JWT).
  app.get('/api/auth/shopify/callback', async (req, reply) => {
    const params = {};
    for (const [k, v] of Object.entries(req.query || {})) params[k] = typeof v === 'string' ? v : '';
    let page;
    try {
      page = await completeCallback(params);
    } catch (err) {
      page = { title: 'Shopify connection failed', message: err.message || 'Unexpected error', autoClose: false };
    }
    reply.header('Cache-Control', 'no-store').type('text/html').send(renderCallbackPage(page));
  });

  // 2) OAuth app (client) management.
  app.post('/api/shopify-oauth-list-clients', authed(async (ctx) => {
    ctx.requirePermission('settings');
    return { success: true, clients: await listClients(ctx.user.id) };
  }));

  app.post('/api/shopify-oauth-save-client', authed(async (ctx, body = {}) => {
    ctx.requirePermission('settings');
    return { success: true, client: await saveClient(ctx.user.id, body) };
  }));

  app.post('/api/shopify-oauth-delete-client', authed(async (ctx, { id } = {}) => {
    ctx.requirePermission('settings');
    return { success: true, deleted: await deleteClient(ctx.user.id, id) };
  }));

  // 3) Start OAuth — returns the authorize URL + state; the client opens a popup and polls status.
  app.post('/api/start-shopify-oauth', authed(async (ctx, { shopDomain, apiVersion, oauthClientId, destinationId } = {}) => {
    ctx.requirePermission('settings');
    const r = await startOauth(ctx.user.id, { oauthClientId, shop: shopDomain, destinationId, apiVersion });
    return {
      success: true,
      serverManaged: true,
      authorizeUrl: r.authorizeUrl,
      state: r.state,
      shopDomain: r.shop,
      apiVersion: r.apiVersion,
      serverCallbackUrl: r.serverCallbackUrl,
    };
  }));

  app.post('/api/shopify-oauth-status', authed(async (ctx, { state } = {}) => {
    ctx.requirePermission('settings');
    return { success: true, ...(await getStatus(ctx.user.id, state)) };
  }));

  // 4) Blogs on the connected shop (token resolved server-side).
  app.post('/api/list-shopify-blogs', authed(async (ctx, { shopDomain, apiVersion, destinationId } = {}) => {
    ctx.requireAnyPermission(['settings', 'export']);
    const blogs = await listBlogs(ctx.user.id, { shop: shopDomain, destinationId, apiVersion });
    return { success: true, blogs, serverManaged: true };
  }));

  app.post('/api/create-shopify-blog', authed(async (ctx, { shopDomain, apiVersion, title, destinationId } = {}) => {
    ctx.requireAnyPermission(['settings', 'export']);
    const blog = await createBlog(ctx.user.id, { shop: shopDomain, destinationId, apiVersion, title });
    return { success: true, blog };
  }));
}
