import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Prisma stops loading .env automatically once a config file exists. Resolve
// the canonical repository-level environment file independently of cwd so
// filtered pnpm commands and direct Prisma commands behave the same way.
try {
  loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') throw error;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});
