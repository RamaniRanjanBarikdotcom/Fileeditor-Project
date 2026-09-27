import { getDb } from '../db/mongo.js';

export default async function healthRoutes(app) {
  app.get('/health', async () => ({ success: true, service: 'blog-generator-backend', ts: new Date().toISOString() }));

  app.get('/health/db', async () => {
    try {
      const count = await getDb().collection('users').countDocuments({});
      return { success: true, db: 'ok', users: count };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
