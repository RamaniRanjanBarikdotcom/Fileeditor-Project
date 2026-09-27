// Per-request user context + permission helpers.
//
// The Electron app keeps a single global `currentUser`. On the web each request
// carries its own JWT, so we resolve the full user document per request and bind
// the same permission/workspace helpers index.js uses.

import { getDb, ObjectId } from '../db/mongo.js';
import { getTokenFromRequest } from '../auth/middleware.js';
import { verifyToken } from '../auth/jwt.js';
import { getUserById, getSetting, setSetting, listUsers } from '../db/actions.js';

const workspaceOwnerCache = new Map();

class AccessError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.statusCode = 403;
    this.name = 'AccessError';
  }
}

class AuthError extends Error {
  constructor(message = 'Not authenticated') {
    super(message);
    this.statusCode = 401;
    this.name = 'AuthError';
  }
}

export { AccessError, AuthError };

/**
 * Build a request context from the bearer token. Loads the live user document so
 * role/permission changes take effect immediately (not just at next login).
 * Throws AuthError when no valid user is present.
 */
export async function loadContext(req) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.uid) throw new AuthError();

  const dbUser = await getDb().collection('users').findOne({ _id: idOf(payload.uid) });
  if (!dbUser) throw new AuthError();
  if ((dbUser.status || 'active') === 'deactive') throw new AuthError('User is deactive. Contact admin.');

  const user = {
    id: String(dbUser._id),
    username: String(dbUser.username || ''),
    email: String(dbUser.email || ''),
    role: String(dbUser.role || 'user'),
    status: String(dbUser.status || 'active'),
    permissions: Array.isArray(dbUser.permissions) ? dbUser.permissions : [],
  };

  const isAdmin = () => user.role === 'admin';
  const hasPermission = (perm) => isAdmin() || user.permissions.includes(perm);
  const requirePermission = (perm) => {
    if (!hasPermission(perm)) throw new AccessError();
  };
  const requireAnyPermission = (perms = []) => {
    if (!Array.isArray(perms) || perms.length === 0) throw new AccessError();
    if (!perms.some((p) => hasPermission(p))) throw new AccessError();
  };
  const requireAdmin = () => {
    if (!isAdmin()) throw new AccessError('Admin access required');
  };

  return {
    user,
    isAdmin,
    hasPermission,
    requirePermission,
    requireAnyPermission,
    requireAdmin,
    getWorkspaceOwnerId: () => getWorkspaceOwnerId(user),
    getUserSettings: () => getUserSettings(user.id),
  };
}

function idOf(id) {
  const raw = String(id ?? '').trim();
  if (ObjectId.isValid(raw) && String(new ObjectId(raw)) === raw) return new ObjectId(raw);
  return raw;
}

export async function getUserSettings(userId) {
  const raw = await getSetting({ userId, key: `user_settings_${userId}` });
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getWorkspaceOwnerId(user) {
  if (!user?.id) return null;
  const userId = String(user.id);
  if (user.role === 'admin') {
    workspaceOwnerCache.set(userId, userId);
    return userId;
  }
  const cached = workspaceOwnerCache.get(userId);
  if (cached) return cached;

  const ownerKey = `workspace_owner_${userId}`;
  const explicitOwner = await getSetting({ userId, key: ownerKey });
  if (explicitOwner && String(explicitOwner).trim()) {
    const ownerId = String(explicitOwner).trim();
    workspaceOwnerCache.set(userId, ownerId);
    return ownerId;
  }

  const users = await listUsers();
  const adminUser = Array.isArray(users) ? users.find((u) => u?.role === 'admin') : null;
  const ownerId = adminUser?.id ? String(adminUser.id) : userId;
  workspaceOwnerCache.set(userId, ownerId);
  if (ownerId !== userId) await setSetting({ userId, key: ownerKey, value: ownerId });
  return ownerId;
}

export function invalidateWorkspaceCache() {
  workspaceOwnerCache.clear();
}

function isBlankWorkspaceSettingsValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return true;
  const text = String(rawValue).trim();
  if (!text) return true;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).length === 0;
    }
  } catch {
    /* non-JSON text → treat as non-blank to avoid destructive overwrite */
  }
  return false;
}

/** Seed a new user's workspace from an existing one (settings + api key). */
export async function cloneWorkspaceConfig({ sourceUserId, targetUserId, overwrite = false }) {
  if (!sourceUserId || !targetUserId) return false;
  if (String(sourceUserId) === String(targetUserId)) return false;

  const entries = [
    { sourceKey: `user_settings_${sourceUserId}`, targetKey: `user_settings_${targetUserId}` },
    { sourceKey: `api_key_${sourceUserId}`, targetKey: `api_key_${targetUserId}` },
  ];

  let changed = false;
  for (const entry of entries) {
    if (!overwrite) {
      const existing = await getSetting({ userId: targetUserId, key: entry.targetKey });
      if (!isBlankWorkspaceSettingsValue(existing)) continue;
    }
    const sourceValue = await getSetting({ userId: sourceUserId, key: entry.sourceKey });
    if (isBlankWorkspaceSettingsValue(sourceValue)) continue;
    await setSetting({ userId: targetUserId, key: entry.targetKey, value: sourceValue });
    changed = true;
  }
  return changed;
}

export async function getPublishDestination(destinationId, userId) {
  const settings = await getUserSettings(userId);
  const destinations = Array.isArray(settings.publishDestinations) ? settings.publishDestinations : [];
  if (!destinationId) return destinations[0] || null;
  return destinations.find((d) => d.id === destinationId) || null;
}

// Re-export getUserById for routes that need it without re-importing actions.
export { getUserById };
