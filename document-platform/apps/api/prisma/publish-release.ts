/**
 * Publishes a downloadable release for a one-time software product.
 *
 *   corepack pnpm release:publish -- --product blog-studio-desktop-windows \
 *     --version 1.0.0 --file ./Blog-Studio-Setup-1.0.0.exe [--changelog "..."] [--publish]
 *
 * Checkout refuses products without a current release, so this is what makes a
 * product sellable. The file is streamed to object storage, its SHA-256 is
 * recorded for customers to verify, and it becomes the current release.
 * --publish also lists the product in the store.
 */
import { createHash } from 'crypto';
import { createReadStream, statSync } from 'fs';
import { basename, extname } from 'path';
import { pipeline } from 'stream/promises';
import { PrismaClient } from '@prisma/client';
import { StorageClient, createStorageConfig } from '@docconv/storage';

const CONTENT_TYPES: Record<string, string> = {
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.msi': 'application/x-msi',
  '.zip': 'application/zip',
  '.dmg': 'application/x-apple-diskimage',
  '.appimage': 'application/octet-stream',
};

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function sha256(file: string) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

async function main() {
  const slug = argument('product');
  const version = argument('version');
  const file = argument('file');
  if (!slug || !version || !file) {
    throw new Error('Usage: --product <slug> --version <x.y.z> --file <path> [--changelog <text>] [--publish]');
  }
  if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('Use a semantic version such as 1.2.0.');
  }
  const extension = extname(file).toLowerCase();
  if (!CONTENT_TYPES[extension]) {
    throw new Error(`Unsupported release file type ${extension || '(none)'}.`);
  }

  const prisma = new PrismaClient();
  try {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) throw new Error(`Product '${slug}' does not exist.`);
    const duplicate = await prisma.productRelease.findFirst({ where: { productId: product.id, version } });
    if (duplicate) throw new Error(`Version ${version} of '${slug}' was already published.`);

    const size = statSync(file).size;
    const checksum = await sha256(file);
    // Release files never expire: they live under releases/, which no
    // temporary-file cleanup touches.
    const storageKey = `releases/${slug}/${version}/${basename(file).replace(/[^A-Za-z0-9._-]/g, '-')}`;
    const storage = new StorageClient(createStorageConfig(process.env as Record<string, string | undefined>));
    await storage.upload('outputs', storageKey, createReadStream(file), CONTENT_TYPES[extension], {
      sha256: checksum,
    });

    await prisma.$transaction([
      prisma.productRelease.updateMany({
        where: { productId: product.id, isCurrent: true },
        data: { isCurrent: false },
      }),
      prisma.productRelease.create({
        data: {
          productId: product.id,
          version,
          changelog: argument('changelog'),
          storageKey,
          fileSizeBytes: BigInt(size),
          fileSha256: checksum,
          isCurrent: true,
        },
      }),
      ...(process.argv.includes('--publish')
        ? [prisma.product.update({ where: { id: product.id }, data: { isPublished: true } })]
        : []),
    ]);
    console.log(`Published ${slug} ${version} (${size} bytes, sha256 ${checksum}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
