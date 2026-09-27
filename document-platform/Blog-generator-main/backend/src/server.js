import './config/dns-bootstrap.js'; // must run before any DNS/connection happens
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';

import { config } from './config/env.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import { registerWebsocket, emitToUser } from './realtime/ws.js';
import { subscribeEvents } from './realtime/pubsub.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import historyRoutes from './routes/history.js';
import usersRoutes from './routes/users.js';
import logsRoutes from './routes/logs.js';
import analyticsRoutes from './routes/analytics.js';
import generateRoutes from './routes/generate.js';
import toolsRoutes from './routes/tools.js';
import publishRoutes from './routes/publish.js';
import shopifyRoutes from './routes/shopify.js';
import remoteRoutes from './routes/remote.js';
import exportRoutes from './routes/exports.js';
import schedulerRoutes from './routes/scheduler.js';

async function main() {
  const app = Fastify({
    logger: true,
    bodyLimit: 25 * 1024 * 1024, // generation/image payloads can be large
    trustProxy: true, // behind nginx — use X-Forwarded-* for client IP + rate limiting
  });

  // Security headers. The SPA/its assets are served by nginx; this is an API, so a
  // strict-ish default with crossOriginResourcePolicy relaxed (the browser app on a
  // different origin reads JSON) is appropriate.
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });

  await app.register(cors, {
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  });

  // Baseline abuse protection. The WebSocket route and health checks are exempt.
  await app.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX || 600),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    allowList: (req) => req.url.startsWith('/ws') || req.url.startsWith('/health'),
  });

  await app.register(websocket);

  // Don't leak stack traces; keep the { success, error } contract the frontend expects.
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    reply.code(status).send({ success: false, error: status >= 500 ? 'Internal server error' : err.message });
  });

  // Connect to the (existing) MongoDB before serving.
  await connectMongo();

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(settingsRoutes);
  await app.register(historyRoutes);
  await app.register(usersRoutes);
  await app.register(logsRoutes);
  await app.register(analyticsRoutes);
  await app.register(generateRoutes);
  await app.register(toolsRoutes);
  await app.register(publishRoutes);
  await app.register(shopifyRoutes);
  await app.register(remoteRoutes);
  await app.register(exportRoutes);
  await app.register(schedulerRoutes);
  registerWebsocket(app);

  // Forward cross-process events (from the worker or other API instances) to the right
  // user's WebSocket connections. Best-effort — no-op if Redis is unavailable.
  subscribeEvents((event) => {
    if (event?.type === 'scheduler' && event.userId) {
      emitToUser(event.userId, 'scheduler-update', {
        jobId: event.jobId || null,
        status: event.status || null,
        action: event.action || 'update',
      });
    }
  });

  // Catch-all for any /api POST channel not (yet) implemented — makes gaps obvious.
  app.post('/api/*', async (req, reply) => {
    reply.code(501).send({ success: false, error: `Not implemented: ${req.url}` });
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Blog-generator backend listening on :${config.port}`);

  // Graceful shutdown: stop accepting connections, then close Mongo.
  const shutdown = async (signal) => {
    app.log.info(`Received ${signal}, shutting down...`);
    try {
      await app.close();
      await closeMongo();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[backend] fatal:', err);
  process.exit(1);
});
