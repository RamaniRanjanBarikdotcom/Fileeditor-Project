import { getDb, toIdFilter, ObjectId } from '../db/mongo.js';
import { verifyPassword, genSalt, hashPasswordWithSalt } from '../auth/password.js';
import { issueToken } from '../auth/jwt.js';
import { getTokenFromRequest } from '../auth/middleware.js';
import { verifyToken } from '../auth/jwt.js';

function sanitizeUser(u) {
  return {
    id: String(u._id),
    username: u.username || '',
    email: u.email || '',
    role: u.role || 'user',
    status: u.status || 'active',
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  };
}

/**
 * Auth routes. Channel-style paths under /api so the frontend apiClient can call
 * them the same way it called the IPC handlers (login, setup-admin, get-auth-state...).
 */
// Coerce credentials to plain strings so a JSON body like {"username":{"$ne":null}}
// can't smuggle a Mongo operator into the query (NoSQL injection). Length-capped too.
function asCredential(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 256);
}

export default async function authRoutes(app) {
  const users = () => getDb().collection('users');

  app.post('/api/login', async (req, reply) => {
    const username = asCredential(req.body?.username);
    const password = asCredential(req.body?.password);
    if (!username || !password) {
      return reply.code(400).send({ success: false, error: 'username and password are required' });
    }
    const user = await users().findOne({ username });
    const hash = String(user?.password_hash || user?.passwordHash || '');
    const salt = String(user?.password_salt || user?.passwordSalt || '');
    if (!user || !verifyPassword(password, hash, salt)) {
      return reply.code(401).send({ success: false, error: 'Invalid credentials' });
    }
    if ((user.status || 'active') === 'deactive') {
      return reply.code(403).send({ success: false, error: 'User is deactive. Contact admin.' });
    }
    const now = new Date();
    await users().updateOne({ _id: user._id }, { $set: { last_online_at: now, last_login_at: now, updated_at: now } });
    return { success: true, user: sanitizeUser(user), auth: issueToken(user) };
  });

  app.post('/api/setup-admin', async (req, reply) => {
    const username = asCredential(req.body?.username);
    const password = asCredential(req.body?.password);
    if (!username || !password) {
      return reply.code(400).send({ success: false, error: 'username and password are required' });
    }
    if ((await users().countDocuments({})) > 0) {
      return reply.code(400).send({ success: false, error: 'Admin already exists' });
    }
    const now = new Date();
    const salt = genSalt();
    const doc = {
      username,
      password_hash: hashPasswordWithSalt(password, salt),
      password_salt: salt,
      role: 'admin',
      status: 'active',
      permissions: ['generate', 'history', 'export', 'bulkExport', 'settings', 'notifications', 'manageUsers'],
      created_at: now,
      updated_at: now,
    };
    const { insertedId } = await users().insertOne(doc);
    const created = await users().findOne({ _id: insertedId });
    return { success: true, user: sanitizeUser(created), auth: issueToken(created) };
  });

  app.post('/api/get-auth-state', async (req) => {
    const count = await users().countDocuments({});
    let currentUser = null;
    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    if (payload?.uid) {
      const dbUser = await users().findOne(toIdFilter(payload.uid));
      if (dbUser && (dbUser.status || 'active') !== 'deactive') currentUser = sanitizeUser(dbUser);
    }
    return { success: true, needsAdminSetup: count === 0, currentUser };
  });

  app.post('/api/get-current-user', async (req) => {
    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload?.uid) return { success: true, user: null };
    const dbUser = await users().findOne(toIdFilter(payload.uid));
    return { success: true, user: dbUser ? sanitizeUser(dbUser) : null };
  });

  // Stateless JWT — logout is handled client-side by dropping the token.
  app.post('/api/logout', async () => ({ success: true }));
}
