/**
 * One-shot: punch checkerboard out of the white-paw icon and write public assets.
 * Usage (in container): node scripts/process-raised-paws-logo.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';

function isBg(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  // Light gray / white checkerboard (not orange, not navy)
  return lum >= 170 && chroma <= 45;
}

async function punchTransparency(inputPath, outPng, outWebp) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const idx = (x, y) => y * width + x;
  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = idx(x, y);
    if (visited[i]) return;
    const o = i * 4;
    if (!isBg(data[o], data[o + 1], data[o + 2])) return;
    visited[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % width;
    const y = (i / width) | 0;
    data[i * 4 + 3] = 0;
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }

  // Soften fringe: near-bg pixels adjacent to transparent → transparent
  const copy = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      const o = i * 4;
      if (copy[o + 3] === 0) continue;
      if (!isBg(copy[o], copy[o + 1], copy[o + 2])) continue;
      let nearT = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (copy[idx(nx, ny) * 4 + 3] === 0) {
          nearT = true;
          break;
        }
      }
      if (nearT) data[o + 3] = 0;
    }
  }

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  console.log(
    inputPath,
    'transparent fraction',
    (transparent / (width * height)).toFixed(3)
  );

  const punched = await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  const trimmed = await sharp(punched).trim({ threshold: 0 }).png().toBuffer();
  const tmeta = await sharp(trimmed).metadata();
  console.log('trimmed', tmeta.width, tmeta.height);

  const size = Math.max(tmeta.width, tmeta.height);
  const pad = Math.ceil(size * 0.04);
  const squared = await sharp(trimmed)
    .resize({
      width: size,
      height: size,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp(squared)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPng);

  await sharp(squared)
    .resize(128, 128, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(outWebp);

  const check = await sharp(outPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const c = check.data;
  const w = check.info.width;
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    return [c[i], c[i + 1], c[i + 2], c[i + 3]];
  };
  console.log('out corners', sample(0, 0), sample(w - 1, 0));
  console.log('wrote', outPng, outWebp);
}

mkdirSync('tmp-logos', { recursive: true });
await punchTransparency(
  'tmp-logos/icon.png',
  'public/raised-paws-logo.png',
  'public/raised-paws-logo-white-paw.webp'
);
