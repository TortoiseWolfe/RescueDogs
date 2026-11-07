import { describe, it, expect } from 'vitest';
import { findOrphanedPhotos } from './orphans';

const base = 'https://x.supabase.co/storage/v1/object/public/pet-photos';
const now = new Date('2026-11-06T12:00:00Z');
const old = '2026-11-01T00:00:00Z';
const fresh = '2026-11-06T11:30:00Z';

describe('findOrphanedPhotos (#372)', () => {
  it('returns old files that no row points at', () => {
    const orphans = findOrphanedPhotos(
      [
        { path: 's/p/kept.webp', createdAt: old },
        { path: 's/p/leaked.webp', createdAt: old },
      ],
      [`${base}/s/p/kept.webp`],
      now
    );
    expect(orphans.map((o) => o.path)).toEqual(['s/p/leaked.webp']);
  });

  it('leaves a recent file alone: its row may not be saved yet', () => {
    const orphans = findOrphanedPhotos(
      [{ path: 's/p/new.webp', createdAt: fresh }],
      [],
      now
    );
    expect(orphans).toEqual([]);
  });

  it('counts a file as used when only pets.photo_url points at it', () => {
    const orphans = findOrphanedPhotos(
      [{ path: 's/p/primary.webp', createdAt: old }],
      [null, `${base}/s/p/primary.webp`],
      now
    );
    expect(orphans).toEqual([]);
  });
});
