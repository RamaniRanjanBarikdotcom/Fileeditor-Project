'use strict';

const { DatabaseSync } = require('node:sqlite');

class BlogDatabase {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS blogs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        html TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS checkpoints (
        job_id TEXT PRIMARY KEY,
        stage TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS destinations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }
  setSetting(key, value) {
    this.db
      .prepare(
        'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run(key, value);
  }
  getSetting(key) {
    return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || null;
  }
  listBlogs() {
    return this.db
      .prepare(
        'SELECT id,title,metadata_json AS metadata,created_at AS createdAt,updated_at AS updatedAt FROM blogs ORDER BY updated_at DESC',
      )
      .all();
  }
  getBlog(id) {
    return (
      this.db
        .prepare(
          'SELECT id,title,html,metadata_json AS metadata,created_at AS createdAt,updated_at AS updatedAt FROM blogs WHERE id=?',
        )
        .get(id) || null
    );
  }
  saveBlog(blog) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO blogs(id,title,html,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,html=excluded.html,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at',
      )
      .run(blog.id, blog.title, blog.html, blog.metadata, now, now);
    return this.getBlog(blog.id);
  }
  getCheckpoint(jobId) {
    const row = this.db
      .prepare('SELECT payload_json AS payload FROM checkpoints WHERE job_id=?')
      .get(jobId);
    return row ? JSON.parse(row.payload) : null;
  }
  saveCheckpoint(jobId, stage, checkpoint) {
    this.db
      .prepare(
        'INSERT INTO checkpoints(job_id,stage,payload_json,updated_at) VALUES (?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET stage=excluded.stage,payload_json=excluded.payload_json,updated_at=excluded.updated_at',
      )
      .run(jobId, stage, JSON.stringify(checkpoint), new Date().toISOString());
  }
  deleteCheckpoint(jobId) {
    this.db.prepare('DELETE FROM checkpoints WHERE job_id=?').run(jobId);
  }
  // Providers
  listProviders() {
    return this.db.prepare('SELECT id, name, config_json AS config FROM providers').all().map(p => ({ ...p, config: JSON.parse(p.config) }));
  }
  getProvider(id) {
    const p = this.db.prepare('SELECT id, name, config_json AS config FROM providers WHERE id=?').get(id);
    return p ? { ...p, config: JSON.parse(p.config) } : null;
  }
  saveProvider(provider) {
    this.db.prepare(
      'INSERT INTO providers(id,name,config_json,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,config_json=excluded.config_json'
    ).run(provider.id, provider.name, JSON.stringify(provider.config || {}), new Date().toISOString());
  }

  // Prompts
  listPrompts() {
    return this.db.prepare('SELECT * FROM prompts').all();
  }
  savePrompt(prompt) {
    this.db.prepare(
      'INSERT INTO prompts(id,name,system_prompt,user_prompt,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,system_prompt=excluded.system_prompt,user_prompt=excluded.user_prompt'
    ).run(prompt.id, prompt.name, prompt.system_prompt, prompt.user_prompt, new Date().toISOString());
  }

  // Destinations
  listDestinations() {
    return this.db.prepare('SELECT id, name, platform, config_json AS config FROM destinations').all().map(d => ({ ...d, config: JSON.parse(d.config) }));
  }
  saveDestination(dest) {
    this.db.prepare(
      'INSERT INTO destinations(id,name,platform,config_json,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,platform=excluded.platform,config_json=excluded.config_json'
    ).run(dest.id, dest.name, dest.platform, JSON.stringify(dest.config || {}), new Date().toISOString());
  }
}

module.exports = { BlogDatabase };
