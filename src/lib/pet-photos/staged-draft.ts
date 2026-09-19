import Dexie, { type Table } from 'dexie';
import { isStorageNearQuota } from '@/lib/offline-queue/storage-quota';
import { createLogger } from '@/lib/logger';

const logger = createLogger('pet-photos:staged-draft');

/**
 * Keep photos chosen for a pet that does not exist yet (#310).
 *
 * WHY A SECOND STORE. The text half of the Add Pet form persists as JSON through
 * `useFormDraft`. Photos cannot: before the pet row exists, `PetPhotoManager` stages
 * each cropped image as `{ id, preview, blob }`, where `blob` is binary and `preview`
 * is an object URL that dies with the document. `localStorage` holds neither. IndexedDB
 * structured-clones a `Blob` directly, and Dexie is already a dependency here — so
 * this adds a table, not a technology.
 *
 * BYTES ARE STORED, NOT BLOBS — and that is not a style choice.
 *
 * WebKit cannot put a `Blob` (or a `File`) into IndexedDB at all. The write
 * transaction fails with `tx.onerror` and a NULL `tx.error`, so it does not even
 * announce itself as a clone failure. Verified directly against Playwright's WebKit
 * build: plain objects, `ArrayBuffer` and `Uint8Array` all round-trip fine; `Blob` and
 * `File` both fail. Chromium and Firefox store Blobs happily, which is exactly what
 * makes this dangerous — it would have worked everywhere except the iPhone, and an
 * iPhone is what a rescue volunteer is holding when they photograph a dog.
 *
 * So each photo is stored as its `ArrayBuffer` plus its MIME type, and the `Blob` is
 * rebuilt on read. `scripts/ci/check-indexeddb-blob.mjs` holds that finding in place.
 *
 * WHAT THIS DELIBERATELY DOES NOT STORE. Not the object URL. It is meaningless in the
 * next document and restoring it would produce four silently broken thumbnails, which
 * is worse than losing the photos outright. Callers regenerate previews with
 * `URL.createObjectURL` from the blob they get back.
 *
 * QUOTA. Four cropped photos is a few megabytes, and a rescue listing many pets in one
 * sitting accumulates drafts. Writes are skipped when the origin is near its quota:
 * failing to save a draft is a disappointment, but filling the user's disk to do it
 * would be a defect, and a quota error mid-write can take the database down with it.
 */

const DB_NAME = 'PetPhotoDraftsV1';
const TABLE = 'stagedPhotos';
/** Matches the text draft's TTL — the two halves must expire together or a listing
 *  comes back with a name and no photos, or photos and no name. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface StagedPhotoRecord {
  /** `${draftKey}::${photoId}` — Dexie needs a single primary key. */
  id: string;
  draftKey: string;
  photoId: string;
  order: number;
  /** Raw bytes. NOT a Blob — WebKit refuses to store one. See the note above. */
  bytes: ArrayBuffer;
  /** Carried separately because an ArrayBuffer has no MIME type of its own. */
  type: string;
  createdAt: number;
}

class PetPhotoDraftDb extends Dexie {
  staged!: Table<StagedPhotoRecord, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      [TABLE]: 'id, draftKey, order, createdAt',
    });
    this.staged = this.table(TABLE);
  }
}

let db: PetPhotoDraftDb | null = null;

/** IndexedDB is absent in SSR and can throw outright in private mode. */
function getDb(): PetPhotoDraftDb | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  try {
    db ??= new PetPhotoDraftDb();
    return db;
  } catch (error) {
    logger.debug('IndexedDB unavailable for photo drafts', { error });
    return null;
  }
}

/**
 * Blob -> ArrayBuffer, without assuming `Blob.prototype.arrayBuffer` exists.
 *
 * Two environments lack it: jsdom (so without this fallback the unit suite cannot
 * exercise the save path AT ALL — it throws, gets swallowed, and stores nothing while
 * every test still passes), and older Safari, which is once again the iPhone a
 * volunteer is holding. FileReader is available in both.
 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(blob);
  });
}

export interface StagedPhotoDraft {
  photoId: string;
  blob: Blob;
}

/**
 * Replace everything stored for this draft.
 *
 * Replace rather than merge: the staged list is the source of truth, and a photo the
 * user removed must not survive in the store and reappear on restore.
 */
export async function saveStagedPhotos(
  draftKey: string,
  photos: StagedPhotoDraft[]
): Promise<void> {
  const database = getDb();
  if (!database) return;

  try {
    // Near quota, skip only writes that would GROW the store. Skipping wholesale
    // meant a removal never persisted, so a photo the user deleted came back on the
    // next restore — a storage guard that silently resurrects deleted content.
    if (await isStorageNearQuota()) {
      const existing = await database.staged
        .where('draftKey')
        .equals(draftKey)
        .count();
      if (photos.length >= existing) {
        logger.debug('Skipping photo draft growth — storage near quota', {
          draftKey,
          existing,
          incoming: photos.length,
        });
        return;
      }
    }

    const now = Date.now();
    const rows: StagedPhotoRecord[] = await Promise.all(
      photos.map(async (photo, order) => ({
        id: `${draftKey}::${photo.photoId}`,
        draftKey,
        photoId: photo.photoId,
        order,
        bytes: await blobToArrayBuffer(photo.blob),
        type: photo.blob.type || 'image/webp',
        createdAt: now,
      }))
    );

    await database.transaction('rw', database.staged, async () => {
      await database.staged.where('draftKey').equals(draftKey).delete();
      if (rows.length > 0) await database.staged.bulkPut(rows);
    });
  } catch (error) {
    // Never let a failed draft save break the form the user is filling in.
    logger.debug('Could not save photo draft', { draftKey, error });
  }
}

/** Ordered photos for this draft. Expired rows are dropped rather than returned. */
export async function loadStagedPhotos(
  draftKey: string
): Promise<StagedPhotoDraft[]> {
  const database = getDb();
  if (!database) return [];

  try {
    const rows = await database.staged
      .where('draftKey')
      .equals(draftKey)
      .toArray();
    if (rows.length === 0) return [];

    const cutoff = Date.now() - TTL_MS;
    if (rows.some((row) => row.createdAt < cutoff)) {
      await clearStagedPhotos(draftKey);
      return [];
    }

    return rows
      .sort((a, b) => a.order - b.order)
      .filter((row) => row.bytes)
      .map((row) => ({
        photoId: row.photoId,
        // Rebuilt here; it was never stored as a Blob. See the WebKit note above.
        blob: new Blob([row.bytes], { type: row.type || 'image/webp' }),
      }));
  } catch (error) {
    logger.debug('Could not read photo draft', { draftKey, error });
    return [];
  }
}

export async function clearStagedPhotos(draftKey: string): Promise<void> {
  const database = getDb();
  if (!database) return;
  try {
    await database.staged.where('draftKey').equals(draftKey).delete();
  } catch (error) {
    logger.debug('Could not clear photo draft', { draftKey, error });
  }
}

/**
 * Drop every expired draft, whoever it belongs to.
 *
 * Per-key TTL only prunes drafts somebody returns to. A rescue who abandons a listing
 * and never opens that form again would otherwise leave its photos on their disk
 * indefinitely, which is the kind of quiet accumulation nobody goes looking for.
 */
export async function pruneExpiredStagedPhotos(): Promise<void> {
  const database = getDb();
  if (!database) return;
  try {
    await database.staged
      .where('createdAt')
      .below(Date.now() - TTL_MS)
      .delete();
  } catch (error) {
    logger.debug('Could not prune photo drafts', { error });
  }
}
