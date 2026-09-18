import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/offline-queue/storage-quota', () => ({
  isStorageNearQuota: vi.fn(async () => false),
}));

import { isStorageNearQuota } from '@/lib/offline-queue/storage-quota';
import {
  saveStagedPhotos,
  loadStagedPhotos,
  clearStagedPhotos,
  pruneExpiredStagedPhotos,
} from './staged-draft';

const mockNearQuota = vi.mocked(isStorageNearQuota);

function photo(id: string, body = 'image-bytes') {
  return { photoId: id, blob: new Blob([body], { type: 'image/webp' }) };
}

/** Distinct key per test — Dexie state is shared across the file. */
let n = 0;
function freshKey() {
  n += 1;
  return `shelter:test:pet:new:${n}`;
}

describe('staged photo drafts', () => {
  beforeEach(() => {
    mockNearQuota.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips photos in order', async () => {
    const key = freshKey();
    await saveStagedPhotos(key, [photo('a'), photo('b'), photo('c')]);

    const loaded = await loadStagedPhotos(key);
    expect(loaded.map((p) => p.photoId)).toEqual(['a', 'b', 'c']);
    expect(loaded).toHaveLength(3);

    // DELIBERATELY NOT ASSERTED HERE: that the Blob itself survives.
    //
    // `fake-indexeddb` does not structured-clone a Blob — it hands back a bare `{}`
    // with no `size` and no `type`. Real browsers do clone Blobs into IndexedDB, and
    // that is verified separately against Chromium
    // (`scripts/ci/check-indexeddb-blob.mjs`). Asserting it here would either fail
    // against a working implementation, or tempt someone into weakening the assertion
    // until it passed — which would leave the binary round-trip untested while
    // looking tested. This file covers the module's LOGIC: ordering, replacement,
    // key isolation, TTL, pruning and the quota guard.
  });

  it('replaces rather than merges, so a removed photo cannot come back', async () => {
    // The staged list is the source of truth. A merge would resurrect a photo the
    // user deliberately deleted.
    const key = freshKey();
    await saveStagedPhotos(key, [photo('a'), photo('b')]);
    await saveStagedPhotos(key, [photo('b')]);

    const loaded = await loadStagedPhotos(key);
    expect(loaded.map((p) => p.photoId)).toEqual(['b']);
  });

  it('keeps drafts for different keys apart', async () => {
    const one = freshKey();
    const two = freshKey();
    await saveStagedPhotos(one, [photo('a')]);
    await saveStagedPhotos(two, [photo('z')]);

    expect((await loadStagedPhotos(one)).map((p) => p.photoId)).toEqual(['a']);
    expect((await loadStagedPhotos(two)).map((p) => p.photoId)).toEqual(['z']);
  });

  it('clears a draft', async () => {
    const key = freshKey();
    await saveStagedPhotos(key, [photo('a')]);
    await clearStagedPhotos(key);
    expect(await loadStagedPhotos(key)).toEqual([]);
  });

  it('saving an empty list clears the draft', async () => {
    const key = freshKey();
    await saveStagedPhotos(key, [photo('a')]);
    await saveStagedPhotos(key, []);
    expect(await loadStagedPhotos(key)).toEqual([]);
  });

  it('drops an expired draft instead of returning it', async () => {
    const key = freshKey();
    // Move Date.now only. Fake timers stall IndexedDB's own async machinery and the
    // awaits below never settle.
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(new Date('2026-01-01T00:00:00Z').getTime());
      await saveStagedPhotos(key, [photo('a')]);
      // Past the 7-day TTL the text half also uses; the two must expire together or
      // a listing returns with photos and no name.
      now.mockReturnValue(new Date('2026-01-09T00:00:00Z').getTime());
      expect(await loadStagedPhotos(key)).toEqual([]);
    } finally {
      now.mockRestore();
    }
  });

  it('prunes expired drafts the user never returns to', async () => {
    const stale = freshKey();
    const current = freshKey();
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(new Date('2026-01-01T00:00:00Z').getTime());
      await saveStagedPhotos(stale, [photo('old')]);
      now.mockReturnValue(new Date('2026-01-20T00:00:00Z').getTime());
      await saveStagedPhotos(current, [photo('new')]);

      await pruneExpiredStagedPhotos();

      expect(await loadStagedPhotos(stale)).toEqual([]);
      expect((await loadStagedPhotos(current)).map((p) => p.photoId)).toEqual([
        'new',
      ]);
    } finally {
      now.mockRestore();
    }
  });

  it('skips the write when storage is near quota', async () => {
    // Failing to save a draft is a disappointment; filling the user's disk to do it
    // would be a defect.
    const key = freshKey();
    mockNearQuota.mockResolvedValue(true);
    await saveStagedPhotos(key, [photo('a')]);
    expect(await loadStagedPhotos(key)).toEqual([]);
  });

  it('still clears when near quota, so Discard always works', async () => {
    const key = freshKey();
    mockNearQuota.mockResolvedValue(false);
    await saveStagedPhotos(key, [photo('a')]);
    mockNearQuota.mockResolvedValue(true);
    await clearStagedPhotos(key);
    expect(await loadStagedPhotos(key)).toEqual([]);
  });
});
