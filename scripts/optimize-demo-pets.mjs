/**
 * One-shot: re-encode demo pet portrait masters to WebP.
 * Masters live in assets/demo-pets (not shipped); output goes to public.
 * Usage (in container): node scripts/optimize-demo-pets.mjs
 *
 * Two sizes:
 * - public/demo-pets/*.webp — homepage portraits.
 * - public/demo-pets/listing/*.webp — the seeded demo shelter's listing photos
 *   (supabase/seed-rescue-demo.sql). Served by GitHub Pages so browsing the
 *   demo pets costs nothing against the Supabase egress quota (#427).
 */
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';

const SRC = 'assets/demo-pets';

const OUTPUTS = [
  // Cards render at h-44 w-44 (176 CSS px); 360 covers 2x displays.
  { dest: 'public/demo-pets', size: 360 },
  // Matches the long edge of real cropped uploads (1200×900).
  { dest: 'public/demo-pets/listing', size: 1200 },
];

const masters = readdirSync(SRC)
  .filter((file) => file.endsWith('.png'))
  .sort();

for (const { dest, size } of OUTPUTS) {
  mkdirSync(dest, { recursive: true });
  let before = 0;
  let after = 0;

  for (const file of masters) {
    const from = path.join(SRC, file);
    const to = path.join(dest, file.replace(/\.png$/, '.webp'));
    await sharp(from)
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 100, effort: 6 })
      .toFile(to);
    before += statSync(from).size;
    after += statSync(to).size;
    console.log(
      `${file} -> ${path.relative('public', to)} ${(statSync(to).size / 1024).toFixed(1)}KB`
    );
  }

  console.log(
    `${dest}: total ${(before / 1048576).toFixed(2)}MiB -> ${(after / 1024).toFixed(0)}KB`
  );
}
