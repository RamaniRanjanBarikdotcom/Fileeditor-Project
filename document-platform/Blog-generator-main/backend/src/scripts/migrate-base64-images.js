// One-off migration: move base64 data-URL images out of MongoDB and into the configured
// image storage endpoint, replacing them with hosted URLs. Shrinks the DB and speeds up
// blog/history loads. Operates on the `image_url` and `image_gallery` fields of `blogs`.
//
// Run inside the backend container (it has MONGODB_URI + the image-storage settings):
//   docker-compose exec backend node src/scripts/migrate-base64-images.js           # dry run (no writes)
//   docker-compose exec backend node src/scripts/migrate-base64-images.js --apply   # actually migrate
//
// Requirements: each blog's workspace owner must have image storage ENABLED in Settings
// (endpoint + token). Blogs owned by users without storage configured are skipped and
// reported, so nothing is lost — re-run after configuring storage if needed.

import '../config/dns-bootstrap.js'; // route Atlas SRV DNS through a public resolver if configured
import { connectMongo, getDb, closeMongo } from '../db/mongo.js';
import { getSetting } from '../db/actions.js';
import { uploadImageToStorage } from '../services/publishService.js';

const APPLY = process.argv.includes('--apply');

const isDataUrl = (value) => typeof value === 'string' && /^data:image\//i.test(value.trim());

async function loadImageStorage(cache, userId) {
  const key = String(userId ?? '');
  if (cache.has(key)) return cache.get(key);
  let storage = null;
  try {
    const raw = await getSetting({ userId: userId ?? null, key: `user_settings_${key}` });
    const parsed = raw ? JSON.parse(raw) : {};
    storage = parsed && typeof parsed === 'object' ? parsed.imageStorage || null : null;
  } catch {
    storage = null;
  }
  cache.set(key, storage);
  return storage;
}

async function main() {
  await connectMongo();
  const blogs = getDb().collection('blogs');

  const query = {
    $or: [
      { image_url: { $regex: '^data:image/', $options: 'i' } },
      { image_gallery: { $elemMatch: { $regex: '^data:image/', $options: 'i' } } },
    ],
  };
  const total = await blogs.countDocuments(query);
  console.log(`[migrate] ${APPLY ? 'APPLY mode (writing)' : 'DRY RUN (no writes)'} — ${total} blog(s) with base64 images.\n`);

  const storageCache = new Map();
  const skippedOwners = new Set();
  let scanned = 0;
  let updated = 0;
  let uploaded = 0;
  let skippedNoStorage = 0;
  let failed = 0;

  const cursor = blogs.find(query);
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;

    const storage = await loadImageStorage(storageCache, doc.user_id);
    if (!storage?.enabled || !String(storage?.endpointUrl || '').trim()) {
      skippedNoStorage += 1;
      skippedOwners.add(String(doc.user_id ?? 'null'));
      continue;
    }

    // Upload each distinct data-URL once per doc.
    const localCache = new Map();
    const upload = async (dataUrl, label) => {
      if (localCache.has(dataUrl)) return localCache.get(dataUrl);
      const hosted = await uploadImageToStorage({
        blog: { id: String(doc._id), title: doc.title || '' },
        imageUrl: dataUrl,
        localImagePath: '',
        storage,
        filenameBase: `${doc.title || 'blog-image'}${label != null ? `-${label}` : ''}`,
      });
      if (!hosted) throw new Error('image storage did not return a URL');
      localCache.set(dataUrl, hosted);
      uploaded += 1;
      return hosted;
    };

    try {
      const set = {};
      let changed = false;

      if (Array.isArray(doc.image_gallery) && doc.image_gallery.some(isDataUrl)) {
        const nextGallery = [];
        for (let i = 0; i < doc.image_gallery.length; i += 1) {
          const item = doc.image_gallery[i];
          nextGallery.push(isDataUrl(item) ? await upload(item, i) : item);
        }
        set.image_gallery = nextGallery;
        changed = true;
      }

      if (isDataUrl(doc.image_url)) {
        set.image_url = await upload(doc.image_url, 'main');
        changed = true;
      }

      if (changed) {
        if (APPLY) await blogs.updateOne({ _id: doc._id }, { $set: { ...set, updated_at: new Date() } });
        updated += 1;
        console.log(`${APPLY ? '✓ migrated' : '• would migrate'} ${doc._id} "${String(doc.title || '').slice(0, 60)}"`);
      }
    } catch (err) {
      failed += 1;
      console.error(`✗ failed ${doc._id}: ${err.message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Mode:                     ${APPLY ? 'APPLY (wrote changes)' : 'DRY RUN (no changes written)'}`);
  console.log(`Blogs scanned:            ${scanned}`);
  console.log(`Blogs ${APPLY ? 'migrated' : 'to migrate'}:    ${updated}`);
  console.log(`Images uploaded:          ${uploaded}`);
  console.log(`Skipped (no storage):     ${skippedNoStorage}`);
  if (skippedOwners.size) console.log(`  owners w/o storage:     ${[...skippedOwners].join(', ')}`);
  console.log(`Failed:                   ${failed}`);
  if (!APPLY) console.log('\nRe-run with --apply to write these changes.');

  await closeMongo();
}

main().catch(async (err) => {
  console.error('[migrate-base64-images] fatal:', err);
  try {
    await closeMongo();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
