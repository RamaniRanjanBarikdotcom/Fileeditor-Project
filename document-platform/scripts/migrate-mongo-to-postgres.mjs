import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiblog_generator';
const ORG_ID = process.env.ORG_ID;

if (!ORG_ID) {
  console.error('ERROR: You must provide an ORG_ID environment variable to assign migrated data.');
  console.error('Usage: ORG_ID=<your-org-id> node scripts/migrate-mongo-to-postgres.mjs');
  process.exit(1);
}

async function run() {
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  const db = mongoClient.db();

  console.log('Connecting to PostgreSQL via Prisma...');
  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    // 1. Migrate Blogs
    console.log('Migrating blogs...');
    const blogs = await db.collection('blogs').find({}).toArray();
    let blogsCount = 0;
    for (const blog of blogs) {
      const existing = await prisma.blogDocument.findUnique({ where: { id: blog._id.toString() } });
      if (!existing) {
        await prisma.blogDocument.create({
          data: {
            id: blog._id.toString(),
            organizationId: ORG_ID,
            title: blog.title || 'Untitled',
            topic: blog.topic || blog.title || 'Unknown Topic',
            language: blog.language || 'English',
            status: blog.status === 'published' ? 'PUBLISHED' : 'DRAFT',
            contentHtml: blog.contentHtml || blog.html || '',
            seoScore: blog.seo_score || 0,
            wordCount: blog.word_count || 0,
            createdAt: blog.created_at ? new Date(blog.created_at) : new Date(),
            updatedAt: blog.updated_at ? new Date(blog.updated_at) : new Date(),
          },
        });
        blogsCount++;
      }
    }
    console.log(`Migrated ${blogsCount} blogs.`);

    // 2. Migrate Schedules
    console.log('Migrating schedules...');
    const schedules = await db.collection('scheduler_jobs').find({}).toArray();
    let schedulesCount = 0;
    for (const job of schedules) {
      const existing = await prisma.blogSchedule.findUnique({ where: { id: job._id.toString() } });
      if (!existing) {
        await prisma.blogSchedule.create({
          data: {
            id: job._id.toString(),
            organizationId: ORG_ID,
            status: job.status === 'active' ? 'PENDING' : 'FAILED',
            runAt: job.run_at ? new Date(job.run_at) : new Date(),
            topic: job.topic || 'Untitled Schedule',
            createdAt: job.created_at ? new Date(job.created_at) : new Date(),
          },
        });
        schedulesCount++;
      }
    }
    console.log(`Migrated ${schedulesCount} schedules.`);

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

run();
