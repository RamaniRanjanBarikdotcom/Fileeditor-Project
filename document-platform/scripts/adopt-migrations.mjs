#!/usr/bin/env node

/**
 * Safely adopt Prisma migrations for a database previously created by
 * `prisma db push`. Never use this as an automatic migration repair tool.
 */

import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDirectory = join(repositoryRoot, 'apps', 'api');
const migrationsDirectory = join(apiDirectory, 'prisma', 'migrations');
const schemaPath = join(apiDirectory, 'prisma', 'schema.prisma');
const dryRun = process.argv.includes('--dry-run');
const backupConfirmed = process.argv.includes('--confirm-backup');

try {
  loadEnvFile(join(repositoryRoot, '.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Create the root .env file before adoption.');
  process.exit(1);
}

if (!dryRun && !backupConfirmed) {
  console.error(
    'Migration adoption changes migration history. Back up the database, then rerun with --confirm-backup.',
  );
  process.exit(1);
}

const executable = join(
  apiDirectory,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

function runPrisma(args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: apiDirectory,
    env: process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.allowDifference && result.status === 2) return result;
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(detail || `Prisma exited with status ${result.status}.`);
  }
  return result;
}

const requireFromApi = createRequire(join(apiDirectory, 'package.json'));
const { PrismaClient } = requireFromApi('@prisma/client');
const prisma = new PrismaClient();

try {
  const table = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public._prisma_migrations')::text AS name`,
  );
  const migrationTableExists = Boolean(table[0]?.name);

  if (migrationTableExists) {
    const history = await prisma.$queryRawUnsafe(
      `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"
       ORDER BY started_at ASC`,
    );
    if (history.length > 0) {
      throw new Error(
        'This database already has Prisma migration history. Run `pnpm db:migrate`; repair partial histories manually after reviewing the failed migration.',
      );
    }
  }

  console.log('Comparing the live database with the current Prisma datamodel...');
  const diff = runPrisma(
    [
      'migrate',
      'diff',
      '--exit-code',
      '--from-url',
      process.env.DATABASE_URL,
      '--to-schema-datamodel',
      schemaPath,
    ],
    { capture: true, allowDifference: true },
  );

  if (diff.status === 2) {
    throw new Error(
      `The live schema does not match the Prisma schema. No history was changed.\n${diff.stdout || diff.stderr}`,
    );
  }

  const migrationNames = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (!migrationNames.length) throw new Error('No migration directories were found.');

  console.log(
    `${dryRun ? 'Would adopt' : 'Adopting'} ${migrationNames.length} migrations on an identical schema.`,
  );
  for (const migrationName of migrationNames) {
    console.log(`  ${dryRun ? 'would mark' : 'marking'} ${migrationName}`);
    if (!dryRun) runPrisma(['migrate', 'resolve', '--applied', migrationName]);
  }

  if (!dryRun) runPrisma(['migrate', 'status']);
  console.log(dryRun ? 'Dry run complete; no migration history was changed.' : 'Migration adoption complete.');
} catch (error) {
  console.error(`Migration adoption failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
