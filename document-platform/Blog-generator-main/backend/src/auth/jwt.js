import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/** Issue a token with the same payload shape the PHP API uses. */
export function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: String(user._id),
    username: String(user.username || ''),
    role: String(user.role || 'user'),
    status: String(user.status || 'active'),
    iat: now,
    exp: now + config.jwtTtlSeconds,
  };
  return {
    tokenType: 'Bearer',
    accessToken: jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' }),
    expiresIn: config.jwtTtlSeconds,
  };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}
