import { verifyToken } from './jwt.js';

/** Extract a bearer token from header, query, or body (mirrors the PHP API). */
export function getTokenFromRequest(req) {
  const auth = req.headers?.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const headerToken = req.headers?.['x-access-token'];
  if (headerToken) return String(headerToken).trim();
  if (req.query?.accessToken) return String(req.query.accessToken).trim();
  if (req.body?.accessToken) return String(req.body.accessToken).trim();
  return '';
}

/** Fastify preHandler that requires a valid JWT and attaches req.user. */
export function requireAuth(req, reply, done) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.uid) {
    reply.code(401).send({ success: false, error: 'Not authenticated' });
    return;
  }
  req.user = { id: payload.uid, username: payload.username, role: payload.role, status: payload.status };
  done();
}

/** Optional auth — attaches req.user when a valid token is present, never rejects. */
export function optionalAuth(req, _reply, done) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (payload?.uid) {
    req.user = { id: payload.uid, username: payload.username, role: payload.role, status: payload.status };
  }
  done();
}
