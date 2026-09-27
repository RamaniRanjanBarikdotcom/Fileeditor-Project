import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Verify a password against a stored hash, mirroring the PHP API's logic:
 *  - if a salt is present  -> PBKDF2-SHA512, 120000 iterations, 64-byte (128 hex) output
 *  - otherwise             -> bcrypt (PHP password_hash / password_verify)
 */
export function verifyPassword(password, storedHash, storedSalt = '') {
  if (!storedHash) return false;
  if (storedSalt) {
    const computed = crypto
      .pbkdf2Sync(password, storedSalt, 120000, 64, 'sha512')
      .toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(computed));
    } catch {
      return false;
    }
  }
  try {
    return bcrypt.compareSync(password, storedHash);
  } catch {
    return false;
  }
}

/** Create a bcrypt hash (used for the initial admin where no salt scheme is needed). */
export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

/** Random salt matching the Electron app (16 random bytes, hex). */
export function genSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * PBKDF2-SHA512 hash matching the Electron app's hashPassword(password, salt).
 * Use this (with genSalt) when creating/updating users so the desktop app and the
 * web backend verify the same credentials interchangeably.
 */
export function hashPasswordWithSalt(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}
