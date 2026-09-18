#!/usr/bin/env node
/**
 * Assert that a real browser can store and return a Blob through IndexedDB.
 *
 * WHY THIS EXISTS. Staged pet photos (#310) are persisted as Blobs in IndexedDB,
 * because that is the only client store that holds binary — `localStorage` cannot,
 * and before the pet row exists the photos have nowhere else to live. The entire
 * photo half of the draft feature rests on that round trip working.
 *
 * The unit suite CANNOT prove it. `fake-indexeddb` does not structured-clone a Blob:
 * it returns a bare `{}` with no `size` and no `type`. So a green
 * `staged-draft.test.ts` says the module's ordering, TTL and quota logic are right,
 * and says nothing at all about whether the bytes survive.
 *
 * WebKit is the reason this runs across browsers rather than just Chromium. Safari
 * has a long history of IndexedDB defects around Blob storage, and an iPhone is the
 * device a rescue volunteer is most likely to be holding when they photograph a dog.
 * A failure here on webkit alone would mean the photo draft silently does nothing for
 * exactly the users it was built for.
 *
 * This checks the PLATFORM CAPABILITY, not this project's wiring — the wiring is what
 * `staged-draft.test.ts` covers. Together they cover the feature; neither does alone.
 */

import { chromium, firefox, webkit } from '@playwright/test';

// IndexedDB is unavailable on an opaque origin, so a data: URL will not do. Serve a
// blank document at a real https origin through request interception.
const ORIGIN = 'https://indexeddb-blob-probe.test/';

const PROBE = async () => {
  const DB = 'blob-probe';
  const STORE = 'items';

  const open = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const original = new Blob([bytes], { type: 'image/webp' });

  const db = await open();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: 'a', blob: original });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const get = tx.objectStore(STORE).get('a');
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => reject(get.error);
  });

  const stored = row?.blob;
  if (!(stored instanceof Blob)) {
    return { ok: false, reason: `returned ${stored?.constructor?.name ?? typeof stored}, not a Blob` };
  }

  // Read it back as bytes: an empty Blob of the right type would still pass
  // `instanceof`, and that is precisely the failure mode worth catching.
  const buffer = new Uint8Array(await stored.arrayBuffer());
  const same =
    buffer.length === bytes.length && buffer.every((b, i) => b === bytes[i]);

  return {
    ok: same && stored.type === 'image/webp',
    size: stored.size,
    type: stored.type,
    bytesMatch: same,
  };
};

const ALL = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];

// BROWSERS=chromium,webkit narrows the run. Unset means all three — the default is
// deliberately the strict one, so a CI job cannot quietly drop webkit coverage.
const wanted = (process.env.BROWSERS ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const browsers = wanted.length
  ? ALL.filter(([name]) => wanted.includes(name))
  : ALL;

if (browsers.length === 0) {
  console.error(`::error::No known browser in BROWSERS="${process.env.BROWSERS}"`);
  process.exit(1);
}

let failed = false;

for (const [name, launcher] of browsers) {
  let browser;
  try {
    browser = await launcher.launch();
    const page = await browser.newPage();
    await page.route(ORIGIN, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>probe</title>',
      })
    );
    await page.goto(ORIGIN);

    const result = await page.evaluate(PROBE);

    if (result.ok) {
      console.log(
        `  ${name.padEnd(9)} Blob survived IndexedDB (size=${result.size}, type=${result.type})`
      );
    } else {
      failed = true;
      console.error(
        `::error::${name}: a Blob does NOT survive an IndexedDB round trip — ${result.reason ?? JSON.stringify(result)}`
      );
      console.error(
        `::error::Staged pet photos rely on this. On ${name}, photo drafts would silently lose the images.`
      );
    }
  } catch (error) {
    failed = true;
    console.error(`::error::${name}: probe could not run — ${String(error)}`);
  } finally {
    await browser?.close();
  }
}

process.exit(failed ? 1 : 0);
