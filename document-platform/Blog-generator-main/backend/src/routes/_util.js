// Shared helpers for channel routes.
//
// The Electron IPC handlers always resolved (HTTP 200) and signalled failure via
// `{ success: false, error }`. We keep that contract so the React components work
// unchanged — with one exception: auth failures return HTTP 401 so the frontend
// apiClient can trigger its logout/`auth-expired` flow.

import { loadContext, AuthError } from '../lib/context.js';

/**
 * Wrap a channel handler that needs an authenticated context.
 * `fn(ctx, body, req, reply)` should return the success payload object.
 */
export function authed(fn) {
  return async (req, reply) => {
    let ctx;
    try {
      ctx = await loadContext(req);
    } catch (err) {
      reply.code(401);
      return { success: false, error: err.message || 'Not authenticated' };
    }
    try {
      return await fn(ctx, req.body || {}, req, reply);
    } catch (err) {
      if (err instanceof AuthError) {
        reply.code(401);
        return { success: false, error: err.message };
      }
      // Access-denied and validation errors keep HTTP 200 with success:false,
      // mirroring the IPC behaviour the renderer already handles.
      return { success: false, error: err.message || 'Request failed' };
    }
  };
}

/** Wrap a handler that should run even without auth (best-effort analytics, etc.). */
export function open(fn) {
  return async (req, reply) => {
    try {
      return await fn(req.body || {}, req, reply);
    } catch (err) {
      return { success: false, error: err.message || 'Request failed' };
    }
  };
}
