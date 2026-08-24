/**
 * One-shot: re-encode demo pet portrait masters to homepage-sized WebP.
 * Masters live in assets/demo-pets (not shipped); output goes to public.
 * Usage (in container): node scripts/optimize-demo-pets.mjs
 */
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';

// Cards render at h-44 w-44 (176 CSS px); 360 covers 2x displays.
const SIZE = 360;
const SRC = 'assets/demo-pets';
const DEST = 'public/demo-pets';

mkdirSync(DEST, { recursive: true });

const masters = readdirSync(SRC)
  .filter((file) => file.endsWith('.png'))
  .sort();

let before = 0;
let after = 0;

for (const file of masters) {
  const from = path.join(SRC, file);
  const to = path.join(DEST, file.replace(/\.png$/, '.webp'));
  await sharp(from)
    .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 100, effort: 6 })
    .toFile(to);
  before += statSync(from).size;
  after += statSync(to).size;
  console.log(`${file} -> ${path.basename(to)} ${(statSync(to).size / 1024).toFixed(1)}KB`);
}

console.log(
  `total ${(before / 1048576).toFixed(2)}MiB -> ${(after / 1024).toFixed(0)}KB`
);
