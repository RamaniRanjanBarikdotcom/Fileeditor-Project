// Loads the repository-level .env before any other API module is evaluated.
//
// Several modules read process.env at import time (for example REDIS_ENABLED
// decides whether BullMQ queues are registered). ConfigModule.forRoot() only
// populates process.env when AppModule's decorator runs, which is after those
// imports, so main.ts must import this file first. Variables that are already
// set by the shell, Docker or the hosting panel always take precedence.
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parseEnv } from 'util';

const candidates = [
  // src/ (ts-node-dev) and dist/ (nest build) are both one level below apps/api.
  resolve(__dirname, '../../../.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env'),
];

for (const file of new Set(candidates)) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
