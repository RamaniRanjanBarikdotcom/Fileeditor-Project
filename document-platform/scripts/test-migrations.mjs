import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migration tests.');

const requireFromApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireFromApi('@prisma/client');
const prismaBin = fileURLToPath(new URL('../apps/api/node_modules/.bin/prisma', import.meta.url));
const suffix = `${Date.now()}_${process.pid}`;
const freshName = `docconv_migration_fresh_${suffix}`;
const adoptedName = `docconv_migration_adopt_${suffix}`;

function databaseUrl(name) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

function run(command, args, url) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

const adminUrl = databaseUrl('postgres');
const admin = new PrismaClient({ datasourceUrl: adminUrl });

async function createDatabase(name) {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
}

async function dropDatabase(name) {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

async function assertReady(url) {
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    const familyColumns = await client.$queryRawUnsafe(
      "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='refresh_sessions' AND column_name='family_id' AND is_nullable='NO'",
    );
    if (Number(familyColumns[0]?.count) !== 1) {
      throw new Error('refresh_sessions.family_id is missing or nullable');
    }
    const migrationFailures = await client.$queryRawUnsafe(
      'SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL',
    );
    if (Number(migrationFailures[0]?.count) !== 0) {
      throw new Error('migration history contains unfinished or rolled-back migrations');
    }
  } finally {
    await client.$disconnect();
  }
}

try {
  await createDatabase(freshName);
  const freshUrl = databaseUrl(freshName);
  run(prismaBin, ['migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], freshUrl);
  // Run the seed through the workspace package so Prisma launches the
  // configured `ts-node prisma/seed.ts` command from apps/api rather than the
  // repository root.
  run(
    'corepack',
    ['pnpm', '--filter', '@docconv/api', 'exec', 'prisma', 'db', 'seed'],
    freshUrl,
  );
  await assertReady(freshUrl);

  await createDatabase(adoptedName);
  const adoptedUrl = databaseUrl(adoptedName);
  run(
    prismaBin,
    [
      'db',
      'push',
      '--accept-data-loss',
      '--skip-generate',
      '--schema',
      'apps/api/prisma/schema.prisma',
    ],
    adoptedUrl,
  );
  run(process.execPath, ['scripts/adopt-migrations.mjs', '--confirm-backup'], adoptedUrl);
  run(prismaBin, ['migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], adoptedUrl);
  await assertReady(adoptedUrl);
  console.log('Fresh and adopted database migration paths passed.');
} finally {
  await dropDatabase(freshName).catch(() => undefined);
  await dropDatabase(adoptedName).catch(() => undefined);
  await admin.$disconnect();
}
