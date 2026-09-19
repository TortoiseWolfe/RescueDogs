import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// The cropper is a canvas-driven third party and irrelevant to draft persistence.
vi.mock('react-easy-crop', () => ({
  default: () => null,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import { PetPhotoManager } from './PetPhotoManager';
import {
  saveStagedPhotos,
  loadStagedPhotos,
} from '@/lib/pet-photos/staged-draft';

/**
 * Regression cover for the defect that made the photo half of #310 actively harmful.
 *
 * `restoredPhotoDraft` was one ref doing two jobs — "restore started" and "restore
 * finished". It was set synchronously at the top of the async restore effect, so the
 * sibling SAVE effect passed its guard in the same commit and called
 * `saveStagedPhotos(key, [])` with the still-empty `staged`. That call DELETES every
 * row for the key before writing nothing, and its transaction was queued ahead of the
 * read. So a rescue who staged four photos, left to fetch the bio and came back found
 * the photos gone — and gone permanently, because the mount had emptied the store.
 *
 * There was no test for this component at all, which is why a mount-ordering bug this
 * severe shipped. These assert the store's CONTENTS after mount, not just the UI:
 * a version that renders nothing is a bug, but a version that also empties IndexedDB
 * is a different and worse one, and only the store check tells them apart.
 */

function photo(id: string, body = 'bytes') {
  return { photoId: id, blob: new Blob([body], { type: 'image/webp' }) };
}

/**
 * A distinct key per test. Dexie state is shared across the file, and the previous
 * test's component can still be settling an async save as the next one starts — which
 * is exactly how this file first produced a failure that looked like a restore bug
 * and was not one.
 */
let n = 0;
function freshKey() {
  n += 1;
  return `shelter:test-shelter:pet:new:${n}`;
}

describe('PetPhotoManager staged-photo drafts', () => {
  it('does not destroy a stored draft when it mounts', async () => {
    const KEY = freshKey();
    await saveStagedPhotos(KEY, [photo('a'), photo('b')]);
    expect(await loadStagedPhotos(KEY)).toHaveLength(2);

    render(
      <PetPhotoManager shelterId="test-shelter" petId={null} draftKey={KEY} />
    );

    // The save effect must not fire with an empty `staged` before the read lands.
    await waitFor(async () => {
      expect(await loadStagedPhotos(KEY)).toHaveLength(2);
    });

    // And give the debounce/effects a further beat to misbehave.
    await new Promise((r) => setTimeout(r, 50));
    expect(await loadStagedPhotos(KEY)).toHaveLength(2);
  });

  it('brings the stored photos back on screen', async () => {
    const KEY = freshKey();
    await saveStagedPhotos(KEY, [photo('a'), photo('b')]);

    const { container } = render(
      <PetPhotoManager shelterId="test-shelter" petId={null} draftKey={KEY} />
    );

    // Queried by selector, not getAllByRole('img'): these thumbnails carry alt="",
    // which gives them the presentation role, so the role query finds nothing.
    await waitFor(
      () => {
        expect(container.querySelectorAll('img[src^="blob:"]')).toHaveLength(2);
      },
      { timeout: 5000 }
    );
  });

  it('persists nothing and reads nothing without a draftKey', async () => {
    // Omitting draftKey must preserve the old in-memory-only behaviour exactly.
    const KEY = freshKey();
    await saveStagedPhotos(KEY, [photo('a')]);

    render(<PetPhotoManager shelterId="test-shelter" petId={null} />);
    await new Promise((r) => setTimeout(r, 50));

    // Untouched: a component with no key must not read or delete another key's rows.
    expect(await loadStagedPhotos(KEY)).toHaveLength(1);
  });

  it('leaves the draft alone once the pet exists', async () => {
    // With a petId, photos upload immediately and live on the server; the draft store
    // is not this component's business any more and must not be rewritten.
    const KEY = freshKey();
    await saveStagedPhotos(KEY, [photo('a')]);

    render(
      <PetPhotoManager
        shelterId="test-shelter"
        petId="pet-123"
        draftKey={KEY}
        initialPhotos={[]}
      />
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(await loadStagedPhotos(KEY)).toHaveLength(1);
  });
});
