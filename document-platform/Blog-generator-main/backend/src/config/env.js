import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from the project root (Blog-generator/.env), falling back to backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.warn(`[config] Missing env ${name} — some features will fail until it is set.`);
  }
  return v || '';
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  publicApiUrl: process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mongoUri: required('MONGODB_URI'),
  mongoDb: process.env.MONGODB_DB || 'aiblog_generator',

  jwtSecret: required('JWT_SECRET'),
  jwtTtlSeconds: Math.max(300, Number(process.env.JWT_TTL_SECONDS || 3600)),

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  aws: {
    region: process.env.AWS_REGION || 'eu-central-1',
    bucket: process.env.S3_BUCKET || '',
    endpoint: process.env.S3_ENDPOINT || undefined,
  },
};
