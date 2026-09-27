import { MongoClient, ObjectId } from 'mongodb';
import { config } from '../config/env.js';

let client = null;
let db = null;

export async function connectMongo() {
  if (db) return db;
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }
  client = new MongoClient(config.mongoUri, { ignoreUndefined: true });
  await client.connect();
  db = client.db(config.mongoDb);
  // Helpful indexes (no-ops if they already exist). createIndex is idempotent.
  await Promise.allSettled([
    db.collection('users').createIndex({ username: 1 }, { unique: false }),
    db.collection('settings').createIndex({ user_id: 1, key: 1 }),
    // Per-user history sort.
    db.collection('blogs').createIndex({ user_id: 1, created_at: -1 }),
    // Workspace-wide history sort (non-admin lists everything sorted by created_at with no
    // user_id filter). Without this Mongo does a full collection scan + in-memory sort,
    // which is the main cause of slow history loads.
    db.collection('blogs').createIndex({ created_at: -1 }),
    // Logs page: filtered + sorted by timestamp.
    db.collection('logs').createIndex({ timestamp: -1 }),
    db.collection('logs').createIndex({ user_id: 1, timestamp: -1 }),
    // Activities (merged into the Logs page) — sorted by created_at.
    db.collection('activities').createIndex({ created_at: -1 }),
    db.collection('activities').createIndex({ user_id: 1, created_at: -1 }),
    // Scheduler: list/poll by status + run time.
    db.collection('scheduler_jobs').createIndex({ user_id: 1, run_at: 1 }),
    db.collection('scheduler_jobs').createIndex({ status: 1, run_at: 1 }),
    db.collection('scheduler_logs').createIndex({ user_id: 1, created_at: -1 }),
    // Publish-status lookups (History tags) + per-blog history.
    db.collection('publish_history').createIndex({ user_id: 1, published_at: -1 }),
    db.collection('publish_history').createIndex({ blog_id: 1, published_at: -1 }),
  ]);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Mongo not connected yet — call connectMongo() first');
  return db;
}

export async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
}

/** Match the PHP/Electron id handling: accept ObjectId hex or raw values. */
export function toIdFilter(id) {
  const raw = String(id ?? '').trim();
  if (ObjectId.isValid(raw) && String(new ObjectId(raw)) === raw) {
    return { _id: new ObjectId(raw) };
  }
  return { _id: raw };
}

export { ObjectId };
