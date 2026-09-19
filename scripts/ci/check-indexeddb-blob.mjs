/**
 * Assert that staged pet photos can actually be stored and read back, in every
 * browser a rescue might be holding.
 *
 * WHY THIS EXISTS. Staged photos (#310) live in IndexedDB, because it is the only
 * client store that holds binary and the pet row does not exist yet. The unit suite
 * cannot verify that: `fake-indexeddb` does not structured-clone binary payloads
 * faithfully, so a green `staged-draft.test.ts` proves the module's ordering, TTL and
 * quota logic and proves nothing about whether the image survives.
 *
 * WHAT IT FOUND, and why the app stores bytes rather than Blobs:
 *
 *   chromium   Blob OK      ArrayBuffer OK
 *   firefox    Blob OK      ArrayBuffer OK
 *   webkit     Blob FAILS   ArrayBuffer OK
 *
 * WebKit refuses a `Blob` (and a `File`) in IndexedDB. The write transaction fires
 * `onerror` with a NULL `tx.error`, so it does not even identify itself as a clone
 * failure — the first version of this script surfaced it only as "page.evaluate:
 * null". Chromium and Firefox store Blobs happily, which is what makes it dangerous:
 * the obvious implementation works everywhere except the iPhone, and an iPhone is
 * what a volunteer is most likely holding when they photograph a dog.
 *
 * So `staged-draft.ts` stores `ArrayBuffer` + MIME type and rebuilds the Blob on read,
 * and THAT is what this asserts. The raw-Blob result is still measured and printed as
 * the evidence for the indirection, but it does not fail the job — on WebKit it is
 * expected to fail. If it ever starts passing there, the workaround could go.
 */

import { chromium, firefox, webkit } from '@playwright/test';

// IndexedDB is unavailable on an opaque origin, so a data: URL will not do. Serve a
// blank document at a real https origin through request interception.
const ORIGIN = 'https://indexeddb-blob-probe.test/';

const PROBE = async () => {
  const BYTES = [137, 80, 78, 71, 13, 10, 26, 10];
  const TYPE = 'image/webp';

  const open = (name) =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('s', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`open: ${request.error?.name ?? 'null'}`));
      request.onblocked = () => reject(new Error('open: blocked'));
    });

  /** Put a value, read it back. Returns the value, or throws a DESCRIBED Error. */
  const roundTrip = async (dbName, value) => {
    const db = await open(dbName);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('s', 'readwrite');
      tx.oncomplete = () => resolve();
      // A null `tx.error` is WebKit's clone-failure signature. Name it rather than
      // rejecting with null, which crosses the bridge as an unreadable "null".
      tx.onerror = () =>
        reject(new Error(`write: ${tx.error?.name ?? 'null error'}`));
      tx.onabort = () =>
        reject(new Error(`write aborted: ${tx.error?.name ?? 'null error'}`));
      try {
        tx.objectStore('s').put({ id: 'a', value });
      } catch (err) {
        // Some engines throw synchronously on a clone failure instead of aborting.
        reject(new Error(`put threw: ${err?.name}: ${err?.message}`));
      }
    });

    return new Promise((resolve, reject) => {
      const tx = db.transaction('s', 'readonly');
      const get = tx.objectStore('s').get('a');
      get.onsuccess = () => resolve(get.result?.value);
      get.onerror = () => reject(new Error(`read: ${get.error?.name ?? 'null'}`));
    });
  };

  const result = { supported: {}, strategy: null };

  // Informational: does this engine accept a raw Blob at all?
  try {
    const back = await roundTrip(
      'probe-blob',
      new Blob([new Uint8Array(BYTES)], { type: TYPE })
    );
    result.supported.blob = back instanceof Blob && back.size === BYTES.length;
  } catch (err) {
    result.supported.blob = false;
    result.supported.blobError = err?.message ?? String(err);
  }

  // Load-bearing: the exact shape `staged-draft.ts` persists.
  try {
    const stored = await roundTrip('probe-bytes', {
      bytes: new Uint8Array(BYTES).buffer,
      type: TYPE,
    });
    const rebuilt = new Blob([stored.bytes], { type: stored.type });
    const read = new Uint8Array(await rebuilt.arrayBuffer());
    result.strategy = {
      ok:
        read.length === BYTES.length &&
        read.every((b, i) => b === BYTES[i]) &&
        rebuilt.type === TYPE,
      size: rebuilt.size,
      type: rebuilt.type,
    };
  } catch (err) {
    result.strategy = { ok: false, reason: err?.message ?? String(err) };
  }

  return result;
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

    const { supported, strategy } = await page.evaluate(PROBE);
    const blobNote = supported.blob
      ? 'raw Blob also works'
      : `raw Blob REFUSED (${supported.blobError ?? 'unknown'}) — this is why we store bytes`;

    if (strategy?.ok) {
      console.log(
        `  ${name.padEnd(9)} bytes+type round trip OK (size=${strategy.size}, type=${strategy.type}) · ${blobNote}`
      );
    } else {
      failed = true;
      console.error(
        `::error::${name}: staged photos CANNOT be persisted — ${strategy?.reason ?? 'bytes did not match'}`
      );
      console.error(
        `::error::On ${name}, photo drafts would silently lose every image.`
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
