import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React, { Profiler, useEffect } from 'react';

// Each queued photo chains several async steps; under full-suite CPU load they
// can exceed the 1s default wait even though nothing is stuck.
configure({ asyncUtilTimeout: 5000 });
// Multi-step flows chain several of those waits, so the per-test limit must
// sit well above asyncUtilTimeout or the test is killed mid-wait.
const FLOW_TIMEOUT = { timeout: 20_000 };

// The cropper is a canvas-driven third party. Like the real one, the stand-in
// reports a crop area whenever its image changes, which enables "Use photo".
// React may keep it mounted between queued photos, so reporting only on mount
// would leave the next photo's button disabled. It reports on a later tick, as
// the real one does after the image loads, so tests must wait for the button.
vi.mock('react-easy-crop', () => ({
  default: function CropperStub({
    image,
    onCropComplete,
  }: {
    image: string;
    onCropComplete: (area: unknown, pixels: unknown) => void;
  }) {
    useEffect(() => {
      const timer = setTimeout(() => {
        onCropComplete({}, { x: 0, y: 0, width: 400, height: 300 });
      }, 0);
      return () => clearTimeout(timer);
    }, [image, onCropComplete]);
    return null;
  },
}));
let preparedCount = 0;
vi.mock('@/lib/pet-photos/image-processing', () => ({
  PET_PHOTO_ASPECT: 4 / 3,
  preparePetPhotoForCrop: vi.fn(async () => {
    preparedCount += 1;
    return `data:image/webp;base64,AAAA${preparedCount}`;
  }),
  createCroppedPetPhoto: vi.fn(
    async () => new Blob(['cropped'], { type: 'image/webp' })
  ),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

const photoServiceMocks = vi.hoisted(() => ({
  reorderPhotos: vi.fn(),
  listPhotos: vi.fn(),
}));

vi.mock('@/services/applications/pet-photo-service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/services/applications/pet-photo-service')
    >();
  return {
    ...actual,
    PetPhotoService: vi.fn().mockImplementation(() => ({
      reorderPhotos: photoServiceMocks.reorderPhotos,
      listPhotos: photoServiceMocks.listPhotos,
      addPhoto: vi.fn(),
      deletePhoto: vi.fn(),
      syncPrimaryPhotoUrl: vi.fn(),
    })),
  };
});

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
/**
 * The crop dialog renders its buttons before they are usable: "Use photo" stays
 * disabled until the cropper reports an area, and all of them while busy. A click
 * on a disabled button is silently dropped, which strands the queue on its photo.
 */
async function clickWhenEnabled(name: string) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
}

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

describe('PetPhotoManager render stability (#338)', () => {
  it('settles when mounted without initialPhotos, as Add Pet does', async () => {
    let commits = 0;
    const countCommit = () => {
      commits += 1;
      if (commits > 50)
        throw new Error('PetPhotoManager is stuck re-rendering');
    };
    const tree = (disabled: boolean) => (
      <Profiler id="photos" onRender={countCommit}>
        <PetPhotoManager
          shelterId="test-shelter"
          petId={null}
          disabled={disabled}
        />
      </Profiler>
    );
    const { rerender } = render(tree(false));
    rerender(tree(true));

    await new Promise((r) => setTimeout(r, 50));
    const settled = commits;
    await new Promise((r) => setTimeout(r, 100));

    expect(settled).toBeLessThan(10);
    expect(commits).toBe(settled);
  });
});

describe('PetPhotoManager multi-select (#338)', FLOW_TIMEOUT, () => {
  function pickFiles(container: HTMLElement, names: string[]) {
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const files = names.map(
      (name) => new File(['x'], name, { type: 'image/jpeg' })
    );
    fireEvent.change(input, { target: { files } });
  }

  it('lets staff pick several photos in one go', () => {
    const { container } = render(
      <PetPhotoManager shelterId="test-shelter" petId={null} />
    );
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    expect(input.multiple).toBe(true);
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy();
  });

  it('crops each picked photo in turn and stages the ones kept', async () => {
    const { container } = render(
      <PetPhotoManager shelterId="test-shelter" petId={null} />
    );

    pickFiles(container, ['a.jpg', 'b.jpg', 'c.jpg']);
    expect(await screen.findByText('Photo 1 of 3')).toBeTruthy();

    await clickWhenEnabled('Use photo');
    expect(await screen.findByText('Photo 2 of 3')).toBeTruthy();

    await clickWhenEnabled('Skip this photo');
    expect(await screen.findByText('Photo 3 of 3')).toBeTruthy();

    await clickWhenEnabled('Use photo');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(container.querySelectorAll('img[src^="blob:"]')).toHaveLength(2);
  });

  it('Cancel all stops the rest of the selection', async () => {
    const { container } = render(
      <PetPhotoManager shelterId="test-shelter" petId={null} />
    );

    pickFiles(container, ['a.jpg', 'b.jpg']);
    await clickWhenEnabled('Cancel all');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(container.querySelectorAll('img[src^="blob:"]')).toHaveLength(0);
  });

  it('keeps only as many as fit and says why', async () => {
    const { container } = render(
      <PetPhotoManager shelterId="test-shelter" petId={null} />
    );

    pickFiles(container, [
      '1.jpg',
      '2.jpg',
      '3.jpg',
      '4.jpg',
      '5.jpg',
      '6.jpg',
    ]);

    expect(
      await screen.findByText(
        'Only 4 more photos fit (4 max), so the first 4 were used.'
      )
    ).toBeTruthy();
    expect(await screen.findByText('Photo 1 of 4')).toBeTruthy();
  });
});

describe('PetPhotoManager order arrows', FLOW_TIMEOUT, () => {
  beforeEach(() => {
    photoServiceMocks.reorderPhotos.mockReset();
    photoServiceMocks.listPhotos.mockReset();
  });

  const photos = [
    {
      id: 'p1',
      pet_id: 'pet-1',
      url: 'https://example.com/1.jpg',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      pet_id: 'pet-1',
      url: 'https://example.com/2.jpg',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('moves a saved photo one place with Later', async () => {
    photoServiceMocks.reorderPhotos.mockResolvedValue(undefined);
    photoServiceMocks.listPhotos.mockResolvedValue([photos[1], photos[0]]);

    render(
      <PetPhotoManager
        shelterId="test-shelter"
        petId="pet-1"
        initialPhotos={photos}
      />
    );

    const later = screen.getAllByRole('button', { name: 'Move later' });
    expect(later[0]).not.toBeDisabled();
    expect(later[1]).toBeDisabled();
    expect(
      screen.getAllByRole('button', { name: 'Move earlier' })[0]
    ).toBeDisabled();

    fireEvent.click(later[0]);
    await waitFor(() => {
      expect(photoServiceMocks.reorderPhotos).toHaveBeenCalledWith('pet-1', [
        'p2',
        'p1',
      ]);
    });
  });

  it('reorders staged photos without talking to the server', async () => {
    const { container } = render(
      <PetPhotoManager shelterId="test-shelter" petId={null} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
          new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
        ],
      },
    });
    await clickWhenEnabled('Use photo');
    expect(await screen.findByText('Photo 2 of 2')).toBeTruthy();
    await clickWhenEnabled('Use photo');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    const before = Array.from(
      container.querySelectorAll('img[src^="blob:"]')
    ).map((img) => img.getAttribute('src'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Move later' })[0]);
    const after = Array.from(
      container.querySelectorAll('img[src^="blob:"]')
    ).map((img) => img.getAttribute('src'));

    expect(after).toEqual([before[1], before[0]]);
    expect(photoServiceMocks.reorderPhotos).not.toHaveBeenCalled();
  });
});
