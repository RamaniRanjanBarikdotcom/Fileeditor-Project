// Job worker (Phase 5). Runs the scheduler: polls due scheduler_jobs across all users
// and executes them server-side (generate → image → publish). Shares the same MongoDB
// as the API. BullMQ/Redis remain available for future per-job scheduling, but the
// poll-based runner mirrors the desktop tick and needs no Redis.

import '../config/dns-bootstrap.js'; // route DNS through a public resolver if configured
import { config } from '../config/env.js';
import { connectMongo } from '../db/mongo.js';
import { startSchedulerRunner } from './schedulerRunner.js';

async function main() {
  console.log('[worker] starting. Redis:', config.redisUrl);
  await connectMongo();
  console.log('[worker] MongoDB connected');
  startSchedulerRunner();
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
