const sharp = require('sharp');

async function main() {
  const input = '/app/public/raised-paws-logo-src.png';
  const output = '/app/public/raised-paws-logo.png';
  const preview = '/app/public/raised-paws-logo-preview-on-orange.png';

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  console.log({ width, height, channels });

  const px = (x, y) => (y * width + x) * channels;

  // Card/paper background (warm off-white). Soft shadow is darker.
  const isPaper = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return (
      r >= 220 &&
      g >= 215 &&
      b >= 205 &&
      Math.max(r, g, b) - Math.min(r, g, b) <= 30
    );
  };

  // 1) Flood-fill paper + near-paper from edges (handles soft fringe)
  const visited = new Uint8Array(width * height);
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);
  let qh = 0;
  let qt = 0;

  const mayErase = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // paper OR soft warm shadow toward logo
    if (isPaper(i)) return true;
    if (r >= 170 && g >= 160 && b >= 145 && r >= b && g >= b - 10) {
      // warm shadow only — not blue navy, not orange metal
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min <= 45) return true;
    }
    return false;
  };

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const id = y * width + x;
    if (visited[id]) return;
    if (!mayErase(px(x, y))) return;
    visited[id] = 1;
    qx[qt] = x;
    qy[qt] = y;
    qt++;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (qh < qt) {
    const x = qx[qh];
    const y = qy[qh];
    qh++;
    data[px(x, y) + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  // 2) Tight circular crop: find opaque content bounds after flood
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0,
    count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[px(x, y) + 3] > 0) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log('opaque after flood', count, 'bounds', {
    minX,
    minY,
    maxX,
    maxY,
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Radius to include outer bronze rim; pad 2px for AA
  const radius = Math.max(maxX - minX, maxY - minY) / 2 + 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) {
        data[px(x, y) + 3] = 0;
      }
    }
  }

  // Crop to content + small pad
  const pad = 4;
  const left = Math.max(0, Math.floor(minX - pad));
  const top = Math.max(0, Math.floor(minY - pad));
  const right = Math.min(width - 1, Math.ceil(maxX + pad));
  const bottom = Math.min(height - 1, Math.ceil(maxY + pad));
  const cw = right - left + 1;
  const ch = bottom - top + 1;
  const cropped = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = px(left + x, top + y);
      const di = (y * cw + x) * 4;
      cropped[di] = data[si];
      cropped[di + 1] = data[si + 1];
      cropped[di + 2] = data[si + 2];
      cropped[di + 3] = data[si + 3];
    }
  }

  await sharp(cropped, { raw: { width: cw, height: ch, channels: 4 } })
    .png()
    .toFile(output);

  const logo = await sharp(output)
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: 280,
      height: 280,
      channels: 4,
      background: { r: 249, g: 115, b: 22, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(preview);

  console.log('Wrote', output, `${cw}x${ch}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
