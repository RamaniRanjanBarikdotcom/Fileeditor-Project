import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidator');

const FORBIDDEN_SECRET_SUBSTRINGS = [
  'local-development',
  'change-before-production',
  'change-in-production',
  'default-secret',
  'super-secret',
  'minioadmin',
];

export interface ValidatedEnv {
  isProduction: boolean;
  trustProxy: string | number | boolean;
  redisUrl?: string;
  corsOrigins: string[];
}

export function validateEnvironment(env: Record<string, string | undefined> = process.env): ValidatedEnv {
  const isProduction = env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Database validation
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required.');
  } else if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string.');
  }

  // Helper to validate secrets
  const validateSecret = (name: string, value: string | undefined, minLength = 32) => {
    if (!value) {
      if (isProduction) {
        errors.push(`${name} is required in production.`);
      } else {
        warnings.push(`${name} is not set; using local development fallback.`);
      }
      return;
    }

    if (value.length < minLength) {
      if (isProduction) {
        errors.push(`${name} must be at least ${minLength} characters long (got ${value.length}).`);
      } else {
        warnings.push(`${name} is shorter than recommended ${minLength} characters.`);
      }
    }

    if (isProduction) {
      const lower = value.toLowerCase();
      for (const forbidden of FORBIDDEN_SECRET_SUBSTRINGS) {
        if (lower.includes(forbidden)) {
          errors.push(`${name} contains forbidden insecure pattern "${forbidden}". Use a strong random secret.`);
          break;
        }
      }
    }
  };

  validateSecret('JWT_SECRET', env.JWT_SECRET, 32);
  validateSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, 32);
  validateSecret('LICENSE_ENCRYPTION_KEY', env.LICENSE_ENCRYPTION_KEY, 32);
  validateSecret('IP_HMAC_SECRET', env.IP_HMAC_SECRET, 16);

  if (env.JWT_SECRET && env.JWT_REFRESH_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be distinct secrets.');
  }

  // Storage validation
  if (isProduction && env.STORAGE_SECRET_KEY === 'minioadmin') {
    errors.push('STORAGE_SECRET_KEY cannot be "minioadmin" in production.');
  }

  if (isProduction && env.CLAMAV_ENABLED !== 'true') {
    errors.push('CLAMAV_ENABLED must be "true" in production; unscanned uploads are not allowed.');
  }

  // Redis validation
  const redisEnabled = env.REDIS_ENABLED !== 'false';
  let redisUrl = env.REDIS_URL;
  if (redisEnabled) {
    if (!redisUrl) {
      const host = env.REDIS_HOST || 'localhost';
      const port = env.REDIS_PORT || '6379';
      const password = env.REDIS_PASSWORD ? `:${encodeURIComponent(env.REDIS_PASSWORD)}@` : '';
      redisUrl = `redis://${password}${host}:${port}`;
    }
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      errors.push('REDIS_URL must begin with redis:// or rediss://');
    }
  }

  // Topology-aware Trust Proxy validation
  let trustProxy: string | number | boolean = 'loopback, linklocal, uniquelocal';
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '') {
    const rawProxy = env.TRUST_PROXY.trim().toLowerCase();
    if (rawProxy === 'true') {
      trustProxy = true;
    } else if (rawProxy === 'false') {
      trustProxy = false;
    } else if (/^\d+$/.test(rawProxy)) {
      trustProxy = parseInt(rawProxy, 10);
    } else {
      trustProxy = env.TRUST_PROXY;
    }
  }

  // CORS validation
  const corsOriginString = env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:4000';
  const corsOrigins = corsOriginString
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProduction && corsOrigins.includes('*')) {
    errors.push('CORS_ORIGIN cannot contain wildcard "*" in production with credentials enabled.');
  }

  // Output warnings
  for (const warning of warnings) {
    logger.warn(`[Config Warning] ${warning}`);
  }

  // Throw if fatal errors encountered
  if (errors.length > 0) {
    const message = `Fatal Environment Configuration Errors:\n  - ${errors.join('\n  - ')}`;
    logger.error(message);
    throw new Error(message);
  }

  return {
    isProduction,
    trustProxy,
    redisUrl,
    corsOrigins,
  };
}
