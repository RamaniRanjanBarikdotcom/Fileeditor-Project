// Cross-process event bus over Redis pub/sub. The API and the worker run as separate
// processes, so the worker can't push to WebSocket clients directly. Instead the worker
// PUBLISHES events here; the API SUBSCRIBES and forwards them to the right user's sockets.
//
// Best-effort by design: if Redis is unavailable, publishing is a no-op and the rest of
// the app keeps working (the Scheduler page's fallback poll still keeps it fresh).

import IORedis from 'ioredis';
import { config } from '../config/env.js';

const CHANNEL = 'app:events';

let publisher = null;
let subscriber = null;
let warnedPub = false;
let warnedSub = false;

function makeClient(onError) {
  const client = new IORedis(config.redisUrl, {
    // Keep trying to reconnect, but never throw on a down Redis.
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 250, 5000),
    reconnectOnError: () => true,
  });
  client.on('error', (err) => onError?.(err));
  return client;
}

/** Publish an app event to all subscribers (the API process[es]). Never throws. */
export function publishEvent(event) {
  try {
    if (!publisher) {
      publisher = makeClient((err) => {
        if (!warnedPub) {
          warnedPub = true;
          console.warn('[pubsub] publisher Redis error:', err?.message || err);
        }
      });
    }
    publisher.publish(CHANNEL, JSON.stringify(event)).catch(() => {});
  } catch {
    /* ignore — pub/sub is best-effort */
  }
}

/** Subscribe to app events. `handler(event)` is called for each parsed message. */
export function subscribeEvents(handler) {
  if (subscriber) return;
  subscriber = makeClient((err) => {
    if (!warnedSub) {
      warnedSub = true;
      console.warn('[pubsub] subscriber Redis error:', err?.message || err);
    }
  });
  subscriber.subscribe(CHANNEL).catch((err) => {
    console.warn('[pubsub] subscribe failed:', err?.message || err);
  });
  subscriber.on('message', (channel, message) => {
    if (channel !== CHANNEL) return;
    try {
      handler(JSON.parse(message));
    } catch {
      /* ignore malformed */
    }
  });
}

/** Convenience: publish a scheduler change for a workspace owner. */
export function publishSchedulerEvent({ userId, jobId = null, status = null, action = 'update' }) {
  if (!userId) return;
  publishEvent({ type: 'scheduler', userId: String(userId), jobId: jobId ? String(jobId) : null, status, action });
}
