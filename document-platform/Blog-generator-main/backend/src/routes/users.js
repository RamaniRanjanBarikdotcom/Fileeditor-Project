// User-management channels — ports of the admin ipcMain handlers.
import { authed } from './_util.js';
import {
  listUsers,
  createUser,
  getUserByUsername,
  getUserById,
  updateUserAccess,
  updateUserPassword,
  deleteUser,
  setSetting,
  logActivity,
} from '../db/actions.js';
import { genSalt, hashPasswordWithSalt } from '../auth/password.js';
import { PERMISSIONS, ALL_PERMISSIONS } from '../lib/permissions.js';
import { cloneWorkspaceConfig, invalidateWorkspaceCache } from '../lib/context.js';

export default async function usersRoutes(app) {
  app.post('/api/list-users', authed(async (ctx) => {
    ctx.requireAdmin();
    const users = await listUsers();
    return { success: true, users: Array.isArray(users) ? users : [] };
  }));

  app.post('/api/create-user', authed(async (ctx, { username, password, role, status, permissions } = {}) => {
    ctx.requireAdmin();
    const nextUsername = String(username || '').trim();
    const nextPassword = String(password || '');
    const requestedRole = String(role || 'user').trim().toLowerCase();
    const requestedStatus = String(status || 'active').trim().toLowerCase();
    const nextRole = requestedRole === 'admin' ? 'admin' : 'user';
    const nextStatus = requestedStatus === 'deactive' ? 'deactive' : 'active';
    const safePermissions = Array.isArray(permissions) ? permissions.filter((p) => PERMISSIONS.includes(p)) : [];

    if (!nextUsername) throw new Error('Username is required');
    if (!nextPassword) throw new Error('Password is required');

    const nextUsernameLower = nextUsername.toLowerCase();
    const existingUsers = await listUsers();
    if ((existingUsers || []).some((u) => String(u?.username || '').trim().toLowerCase() === nextUsernameLower)) {
      throw new Error('Username already exists');
    }

    const salt = genSalt();
    const hash = hashPasswordWithSalt(nextPassword, salt);
    const createdUserId = await createUser({
      username: nextUsername,
      email: '',
      passwordHash: hash,
      passwordSalt: salt,
      role: nextRole,
      status: nextStatus,
      permissions: nextRole === 'admin' ? ALL_PERMISSIONS : safePermissions,
    });

    const createdUser = await getUserByUsername(nextUsername);
    const targetUserId = createdUser?.id || createdUserId || null;
    if (ctx.user.id && targetUserId) {
      const ownerId = nextRole === 'admin' ? String(targetUserId) : String(ctx.user.id);
      await setSetting({ userId: targetUserId, key: `workspace_owner_${targetUserId}`, value: ownerId });
      await cloneWorkspaceConfig({ sourceUserId: ctx.user.id, targetUserId, overwrite: true });
    }

    await logActivity({ userId: ctx.user.id, action: 'admin.createUser', details: `Created user "${nextUsername}"` });
    invalidateWorkspaceCache();
    return { success: true };
  }));

  app.post('/api/update-user-access', authed(async (ctx, { userId, permissions, role, status } = {}) => {
    ctx.requireAdmin();
    if (!userId) throw new Error('User ID is required');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    const requestedRole = String(role || user.role || 'user').toLowerCase();
    const nextRole = requestedRole === 'admin' ? 'admin' : 'user';
    const requestedStatus = String(status || user.status || 'active').toLowerCase();
    const nextStatus = requestedStatus === 'deactive' ? 'deactive' : 'active';
    const safePermissions = Array.isArray(permissions)
      ? permissions.filter((p) => PERMISSIONS.includes(p))
      : user.permissions || [];

    if (String(ctx.user.id) === String(userId) && nextStatus === 'deactive') {
      throw new Error('You cannot deactivate your own account');
    }

    await updateUserAccess({
      id: userId,
      role: nextRole,
      status: nextStatus,
      permissions: nextRole === 'admin' ? ALL_PERMISSIONS : safePermissions,
    });
    await logActivity({ userId: ctx.user.id, action: 'admin.updateUser', details: `Updated access for "${user.username}"` });
    invalidateWorkspaceCache();
    return { success: true };
  }));

  app.post('/api/change-user-password', authed(async (ctx, { userId, password } = {}) => {
    ctx.requireAdmin();
    if (!userId) throw new Error('User ID is required');
    const nextPassword = String(password || '');
    if (!nextPassword) throw new Error('Password is required');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    const salt = genSalt();
    const hash = hashPasswordWithSalt(nextPassword, salt);
    await updateUserPassword({ id: userId, passwordHash: hash, passwordSalt: salt });
    await logActivity({ userId: ctx.user.id, action: 'admin.changeUserPassword', details: `Changed password for "${user.username}"` });
    return { success: true };
  }));

  app.post('/api/delete-user', authed(async (ctx, { userId } = {}) => {
    ctx.requireAdmin();
    if (!userId) throw new Error('User ID is required');
    if (String(ctx.user.id) === String(userId)) throw new Error('You cannot delete your own account');
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    const deletedCount = await deleteUser({ id: userId });
    if (!deletedCount) throw new Error('User could not be deleted');
    await logActivity({ userId: ctx.user.id, action: 'admin.deleteUser', details: `Deleted user "${user.username}"` });
    return { success: true };
  }));
}
