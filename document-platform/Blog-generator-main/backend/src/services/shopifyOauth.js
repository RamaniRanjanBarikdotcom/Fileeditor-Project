// Server-side Shopify OAuth — ported from php-api/blog-gen.php /shopify/* routes.
// Uses the SAME MongoDB collections so data is interchangeable with the PHP backend:
//   shopify_oauth_clients   { user_id, name, client_id, client_secret_enc, ... }
//   shopify_oauth_states    { state, user_id, oauth_client_id, shop, destination_id, api_version, status, error, expires_at }
//   shopify_connections     { user_id, shop, destination_id, oauth_client_id, access_token_enc, scope, api_version }
//
// On the web the Shopify redirect can target the backend callback directly — no
// desktop localhost bounce is needed.

import crypto from 'node:crypto';
import axios from 'axios';
import { getDb, ObjectId } from '../db/mongo.js';
import { config } from '../config/env.js';
import { encryptSecret, decryptSecret } from '../lib/shopify-server-crypto.js';

const col = (name) => getDb().collection(name);

function parseObjectId(id) {
  const raw = String(id ?? '').trim();
  if (ObjectId.isValid(raw) && String(new ObjectId(raw)) === raw) return new ObjectId(raw);
  return raw;
}

export function normalizeShop(value) {
  return String(value || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function verifyHmac(params, secret) {
  const hmac = String(params.hmac || '');
  if (!hmac || !secret) return false;
  const pairs = Object.keys(params)
    .filter((k) => k !== 'hmac' && k !== 'signature')
    .sort()
    .map((k) => `${k}=${typeof params[k] === 'string' ? params[k] : ''}`);
  const digest = crypto.createHmac('sha256', secret).update(pairs.join('&')).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

async function shopifyApiRequest(method, url, accessToken, body = null) {
  const headers = { Accept: 'application/json', 'X-Shopify-Access-Token': accessToken };
  if (body !== null) headers['Content-Type'] = 'application/json';
  const resp = await axios.request({
    method,
    url,
    headers,
    data: body !== null ? body : undefined,
    timeout: 30000,
    validateStatus: () => true,
  });
  const data = resp.data && typeof resp.data === 'object' ? resp.data : {};
  return { status: resp.status, body: data };
}

function mapClient(doc) {
  return {
    id: String(doc._id ?? ''),
    name: String(doc.name ?? ''),
    clientId: String(doc.client_id ?? ''),
    hasSecret: String(doc.client_secret_enc ?? '').trim() !== '',
    createdAt: doc.created_at ?? null,
    updatedAt: doc.updated_at ?? null,
  };
}

/* ------------------------------ clients ------------------------------ */

export async function listClients(userId) {
  const docs = await col('shopify_oauth_clients').find({ user_id: userId }).sort({ created_at: -1 }).limit(200).toArray();
  return docs.map(mapClient);
}

export async function saveClient(userId, { id = '', name = '', clientId = '', clientSecret = '' } = {}) {
  const cid = String(clientId).trim();
  if (cid === '') throw new Error('clientId is required');
  const now = new Date();
  const hasNewSecret = clientSecret !== '' && clientSecret !== '********' && clientSecret !== '••••••••';
  let doc;
  if (String(id).trim() !== '') {
    const filter = { _id: parseObjectId(id), user_id: userId };
    const set = { name: String(name).trim(), client_id: cid, updated_at: now };
    if (hasNewSecret) set.client_secret_enc = encryptSecret(clientSecret);
    await col('shopify_oauth_clients').updateOne(filter, { $set: set });
    doc = await col('shopify_oauth_clients').findOne(filter);
  } else {
    const { insertedId } = await col('shopify_oauth_clients').insertOne({
      user_id: userId,
      name: String(name).trim(),
      client_id: cid,
      client_secret_enc: hasNewSecret ? encryptSecret(clientSecret) : '',
      created_at: now,
      updated_at: now,
    });
    doc = await col('shopify_oauth_clients').findOne({ _id: insertedId });
  }
  if (!doc) throw new Error('Failed to save OAuth app');
  return mapClient(doc);
}

export async function deleteClient(userId, id) {
  const { deletedCount } = await col('shopify_oauth_clients').deleteOne({ _id: parseObjectId(id), user_id: userId });
  return deletedCount > 0;
}

/* ------------------------------ oauth start / status ------------------------------ */

export function serverCallbackUrl() {
  if (process.env.SHOPIFY_OAUTH_REDIRECT_URL) return process.env.SHOPIFY_OAUTH_REDIRECT_URL;
  return `${config.publicApiUrl.replace(/\/+$/, '')}/api/auth/shopify/callback`;
}

export async function startOauth(userId, { oauthClientId = '', shop = '', destinationId = '', apiVersion = '2024-01', scope = '' } = {}) {
  const cleanShop = normalizeShop(shop);
  const clientRecordId = String(oauthClientId).trim();
  if (clientRecordId === '' || cleanShop === '') throw new Error('oauthClientId and shop are required');
  const version = String(apiVersion || '2024-01').trim() || '2024-01';
  const reqScope = String(scope || '').trim() || 'read_content,write_content,write_files';

  const clientDoc = await col('shopify_oauth_clients').findOne({ _id: parseObjectId(clientRecordId), user_id: userId });
  if (!clientDoc) throw new Error('OAuth app not found');
  const clientId = String(clientDoc.client_id || '');
  if (decryptSecret(String(clientDoc.client_secret_enc || '')) === '') {
    throw new Error('Client secret is missing for this OAuth app. Re-enter it in Settings.');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  await col('shopify_oauth_states').insertOne({
    state,
    user_id: userId,
    oauth_client_id: clientRecordId,
    shop: cleanShop,
    destination_id: String(destinationId || ''),
    api_version: version,
    status: 'pending',
    error: '',
    created_at: now,
    updated_at: now,
    expires_at: new Date(now.getTime() + 10 * 60 * 1000),
  });

  const redirectUri = serverCallbackUrl();
  const authorizeUrl =
    `https://${cleanShop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(reqScope)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return { authorizeUrl, state, shop: cleanShop, apiVersion: version, redirectUri, serverCallbackUrl: redirectUri };
}

export async function getStatus(userId, state) {
  const s = String(state || '').trim();
  if (s === '') throw new Error('state is required');
  const doc = await col('shopify_oauth_states').findOne({ state: s, user_id: userId });
  if (!doc) throw new Error('Unknown state');
  return {
    status: String(doc.status || 'pending'),
    shop: String(doc.shop || ''),
    destinationId: String(doc.destination_id || ''),
    error: String(doc.error || ''),
  };
}

/* ------------------------------ public callback ------------------------------ */

/**
 * Handle Shopify's redirect (no app JWT here — identity comes from the stored state).
 * Returns { title, message, autoClose } for the HTML page to render.
 */
export async function completeCallback(params = {}) {
  const fail = async (stateDoc, reason) => {
    if (stateDoc) {
      await col('shopify_oauth_states').updateOne({ state: String(stateDoc.state || '') }, { $set: { status: 'failed', error: reason, updated_at: new Date() } });
    }
    return { title: 'Shopify connection failed', message: reason, autoClose: false };
  };

  const state = String(params.state || '').trim();
  const code = String(params.code || '').trim();
  const shop = normalizeShop(String(params.shop || ''));

  const stateDoc = state !== '' ? await col('shopify_oauth_states').findOne({ state }) : null;
  if (!stateDoc) return { title: 'Shopify connection failed', message: 'Invalid or expired authorization state.', autoClose: false };
  if (String(stateDoc.status || '') === 'complete') return { title: 'Shopify connected', message: 'This store is already connected.', autoClose: true };
  if (stateDoc.expires_at && new Date(stateDoc.expires_at) < new Date()) return fail(stateDoc, 'Authorization expired. Please try again.');
  if (code === '' || shop === '') return fail(stateDoc, 'Missing shop or code.');
  if (shop !== normalizeShop(String(stateDoc.shop || ''))) return fail(stateDoc, 'Shop mismatch.');

  const clientDoc = await col('shopify_oauth_clients').findOne({ _id: parseObjectId(String(stateDoc.oauth_client_id || '')), user_id: String(stateDoc.user_id || '') });
  if (!clientDoc) return fail(stateDoc, 'OAuth app not found.');
  const clientId = String(clientDoc.client_id || '');
  const clientSecret = decryptSecret(String(clientDoc.client_secret_enc || ''));
  if (clientSecret === '') return fail(stateDoc, 'Stored client secret unavailable.');
  if (!verifyHmac(params, clientSecret)) return fail(stateDoc, 'HMAC verification failed.');

  let resp;
  try {
    resp = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      { client_id: clientId, client_secret: clientSecret, code },
      { timeout: 30000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, validateStatus: () => true }
    );
  } catch (e) {
    return fail(stateDoc, `Token exchange request failed: ${e.message}`);
  }
  if (resp.status < 200 || resp.status >= 300) {
    const err = resp.data?.error_description || resp.data?.error || `HTTP ${resp.status}`;
    return fail(stateDoc, `Token exchange rejected: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }
  const accessToken = String(resp.data?.access_token || '');
  if (accessToken === '') return fail(stateDoc, 'No access token returned from Shopify.');

  const userId = String(stateDoc.user_id || '');
  const destinationId = String(stateDoc.destination_id || '');
  const now = new Date();
  await col('shopify_connections').updateOne(
    { user_id: userId, shop, destination_id: destinationId },
    {
      $set: {
        user_id: userId,
        shop,
        destination_id: destinationId,
        oauth_client_id: String(stateDoc.oauth_client_id || ''),
        access_token_enc: encryptSecret(accessToken),
        scope: String(resp.data?.scope || ''),
        api_version: String(stateDoc.api_version || '2024-01'),
        connected_at: now,
        updated_at: now,
      },
    },
    { upsert: true }
  );
  await col('shopify_oauth_states').updateOne({ state }, { $set: { status: 'complete', shop, error: '', updated_at: now } });

  return { title: 'Shopify connected', message: 'Your Shopify store is now connected.', autoClose: true };
}

/* ------------------------------ token + blogs ------------------------------ */

async function findConnection(userId, shop, destinationId = '') {
  const cleanShop = normalizeShop(shop);
  if (cleanShop === '') return null;
  if (destinationId !== '') {
    const doc = await col('shopify_connections').findOne({ user_id: userId, shop: cleanShop, destination_id: destinationId });
    if (doc) return doc;
  }
  return col('shopify_connections').findOne({ user_id: userId, shop: cleanShop }, { sort: { updated_at: -1 } });
}

export async function getAccessToken(userId, shop, destinationId = '') {
  const conn = await findConnection(userId, shop, destinationId);
  if (!conn) throw new Error('No Shopify connection for this shop. Reconnect in Settings.');
  const token = decryptSecret(String(conn.access_token_enc || ''));
  if (token === '') throw new Error('Stored Shopify access token unavailable. Reconnect in Settings.');
  return token;
}

export async function listBlogs(userId, { shop = '', destinationId = '', apiVersion = '2024-01' } = {}) {
  const cleanShop = normalizeShop(shop);
  if (cleanShop === '') throw new Error('shop is required');
  const version = String(apiVersion || '2024-01').trim() || '2024-01';
  const accessToken = await getAccessToken(userId, cleanShop, destinationId);
  const resp = await shopifyApiRequest('GET', `https://${cleanShop}/admin/api/${version}/blogs.json`, accessToken);
  if (resp.status < 200 || resp.status >= 300) {
    const err = resp.body?.errors ?? `HTTP ${resp.status}`;
    throw new Error(`Shopify blogs request failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }
  return Array.isArray(resp.body?.blogs) ? resp.body.blogs : [];
}

export async function createBlog(userId, { shop = '', destinationId = '', apiVersion = '2024-01', title = '' } = {}) {
  const cleanShop = normalizeShop(shop);
  const cleanTitle = String(title).trim();
  if (cleanShop === '' || cleanTitle === '') throw new Error('shop and title are required');
  const version = String(apiVersion || '2024-01').trim() || '2024-01';
  const accessToken = await getAccessToken(userId, cleanShop, destinationId);
  const resp = await shopifyApiRequest('POST', `https://${cleanShop}/admin/api/${version}/blogs.json`, accessToken, { blog: { title: cleanTitle } });
  if (resp.status < 200 || resp.status >= 300) {
    const err = resp.body?.errors ?? `HTTP ${resp.status}`;
    throw new Error(`Shopify create-blog failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }
  return resp.body?.blog || null;
}

export async function testConnection(userId, { shop = '', destinationId = '', apiVersion = '2024-01' } = {}) {
  const cleanShop = normalizeShop(shop);
  if (cleanShop === '') throw new Error('shop is required');
  const version = String(apiVersion || '2024-01').trim() || '2024-01';
  const accessToken = await getAccessToken(userId, cleanShop, destinationId);
  const resp = await shopifyApiRequest('GET', `https://${cleanShop}/admin/api/${version}/shop.json`, accessToken);
  if (resp.status < 200 || resp.status >= 300) {
    const err = resp.body?.errors ?? `HTTP ${resp.status}`;
    throw new Error(`Shopify shop request failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }
  return resp.body?.shop || null;
}
