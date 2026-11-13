#!/usr/bin/env tsx
/**
 * Pet photo orphan sweep (#372)
 *
 * Lists files in the public `pet-photos` bucket that no `pet_photos.url` or
 * `pets.photo_url` points at and that are older than 24 hours. Dry run by
 * default; pass --delete to remove them. Needs the service-role key.
 *
 *   docker compose exec rescuedogs pnpm exec tsx scripts/sweep-pet-photo-orphans.ts
 *   docker compose exec rescuedogs pnpm exec tsx scripts/sweep-pet-photo-orphans.ts --delete
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  findOrphanedPhotos,
  type StoredPhotoObject,
} from '../src/lib/pet-photos/orphans';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BUCKET = 'pet-photos';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const shouldDelete = process.argv.includes('--delete');

/** Storage lists one folder level at a time: shelter/pet/file. */
async function listAll(prefix = '', depth = 0): Promise<StoredPhotoObject[]> {
  const found: StoredPhotoObject[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back with no id; files have one.
      if (entry.id) {
        found.push({
          path,
          createdAt: entry.created_at ?? new Date().toISOString(),
        });
      } else if (depth < 4) {
        found.push(...(await listAll(path, depth + 1)));
      }
    }
    if (!data || data.length < pageSize) break;
  }
  return found;
}

async function main() {
  const objects = await listAll();

  const [gallery, primary] = await Promise.all([
    supabase.from('pet_photos').select('url'),
    supabase.from('pets').select('photo_url'),
  ]);
  if (gallery.error) throw new Error(`pet_photos: ${gallery.error.message}`);
  if (primary.error) throw new Error(`pets: ${primary.error.message}`);

  const referenced = [
    ...(gallery.data ?? []).map((row) => row.url as string | null),
    ...(primary.data ?? []).map((row) => row.photo_url as string | null),
  ];
  const orphans = findOrphanedPhotos(objects, referenced, new Date());

  console.log(
    `${objects.length} files in the bucket, ${orphans.length} orphaned`
  );
  for (const orphan of orphans) {
    console.log(`  ${orphan.path}  (${orphan.createdAt})`);
  }

  if (orphans.length === 0) return;
  if (!shouldDelete) {
    console.log('Dry run. Re-run with --delete to remove them.');
    return;
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(orphans.map((orphan) => orphan.path));
  if (error) throw new Error(`remove: ${error.message}`);
  console.log(`Deleted ${orphans.length} files.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
