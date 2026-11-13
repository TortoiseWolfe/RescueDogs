import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MAX_PET_PHOTOS,
  PetPhotoService,
  isPetPhotosTableMissing,
  legacyPetPhotoId,
} from './pet-photo-service';

function mockFrom(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'maybeSingle',
    'single',
  ]) {
    builder[m] = vi.fn(self);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.order = vi.fn().mockResolvedValue(result);
  return builder;
}

describe('PetPhotoService (#273)', () => {
  const petId = '11111111-1111-1111-1111-111111111101';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists photos ordered by sort_order', async () => {
    const rows = [
      {
        id: 'photo-1',
        pet_id: petId,
        url: 'https://example.com/a.webp',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const from = mockFrom({ data: rows, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new PetPhotoService(supabase);
    const result = await service.listPhotos(petId);
    expect(result).toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith('pet_photos');
  });

  it('returns empty list when pet_photos table is unavailable', async () => {
    const from = mockFrom({
      data: null,
      error: { message: 'relation pet_photos does not exist' },
    });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new PetPhotoService(supabase);
    const result = await service.listPhotos(petId);
    expect(result).toEqual([]);
  });

  it('detects missing pet_photos from schema cache error', () => {
    expect(
      isPetPhotosTableMissing({
        message:
          "Could not find the table 'public.pet_photos' in the schema cache",
      })
    ).toBe(true);
  });

  it('addPhoto falls back to pets.photo_url when gallery table missing', async () => {
    const insertFrom = mockFrom({
      data: null,
      error: {
        message:
          "Could not find the table 'public.pet_photos' in the schema cache",
      },
    });
    const updateFrom = mockFrom({ data: { id: petId }, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pet_photos') return insertFrom;
        if (table === 'pets') return updateFrom;
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const service = new PetPhotoService(supabase);
    const url = 'https://example.com/bubba.webp';
    const result = await service.addPhoto(petId, url, 0);

    expect(result.id).toBe(legacyPetPhotoId(petId));
    expect(result.url).toBe(url);
    expect(updateFrom.update).toHaveBeenCalledWith({ photo_url: url });
  });

  it('deletePhoto clears pets.photo_url for legacy synthetic ids', async () => {
    const updateFrom = mockFrom({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pets') return updateFrom;
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const service = new PetPhotoService(supabase);
    await service.deletePhoto(legacyPetPhotoId(petId));

    expect(updateFrom.update).toHaveBeenCalledWith({ photo_url: null });
    expect(updateFrom.eq).toHaveBeenCalledWith('id', petId);
  });

  it('syncs primary photo_url from first gallery row', async () => {
    const listFrom = mockFrom({
      data: [
        {
          id: 'photo-1',
          pet_id: petId,
          url: 'https://example.com/primary.webp',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const updateFrom = mockFrom({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pet_photos') return listFrom;
        if (table === 'pets') return updateFrom;
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const service = new PetPhotoService(supabase);
    await service.syncPrimaryPhotoUrl(petId);
    expect(supabase.from).toHaveBeenCalledWith('pets');
    expect(updateFrom.update).toHaveBeenCalled();
  });

  it('rejects reorder above max photos', async () => {
    const ids = Array.from({ length: MAX_PET_PHOTOS + 1 }, (_, i) => `id-${i}`);
    const supabase = { from: vi.fn(), rpc: vi.fn() } as any;
    const service = new PetPhotoService(supabase);
    await expect(service.reorderPhotos(petId, ids)).rejects.toThrow(
      `Maximum ${MAX_PET_PHOTOS} photos per pet`
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('reorders in one atomic RPC instead of row-by-row updates (#338)', async () => {
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any;
    const service = new PetPhotoService(supabase);

    await service.reorderPhotos(petId, ['photo-3', 'photo-1', 'photo-2']);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('reorder_pet_photos', {
      p_pet_id: petId,
      p_photo_ids: ['photo-3', 'photo-1', 'photo-2'],
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('explains a stale photo list instead of a raw database error (#338)', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'invalid_photo_order' },
      }),
    } as any;
    const service = new PetPhotoService(supabase);

    await expect(service.reorderPhotos(petId, ['photo-1'])).rejects.toThrow(
      'The photos changed since this page loaded. Refresh and try again.'
    );
  });

  describe('removes the stored image files too (#372)', () => {
    const base = 'https://x.supabase.co/storage/v1/object/public/pet-photos';
    const urlA = `${base}/shelter-1/pet-1/111.webp`;
    const urlB = `${base}/shelter-1/pet-1/222.webp`;

    function storageMock(result: { error: unknown } = { error: null }) {
      const remove = vi.fn().mockResolvedValue(result);
      const storage = { from: vi.fn().mockReturnValue({ remove }) };
      return { remove, storage };
    }

    /** Query builder whose awaited result is `result`, for any chain. */
    function chain(result: { data: unknown; error: unknown }) {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'update', 'delete', 'eq']) {
        b[m] = vi.fn(() => b);
      }
      b.maybeSingle = vi.fn().mockResolvedValue(result);
      b.then = (resolve: (r: unknown) => unknown) => resolve(result);
      return b;
    }

    it('removeStoredPhotos sends bucket paths to Storage', async () => {
      const { remove, storage } = storageMock();
      const service = new PetPhotoService({ storage } as any);

      await service.removeStoredPhotos([urlA, urlB]);

      expect(storage.from).toHaveBeenCalledWith('pet-photos');
      expect(remove).toHaveBeenCalledWith([
        'shelter-1/pet-1/111.webp',
        'shelter-1/pet-1/222.webp',
      ]);
    });

    it('removeStoredPhotos skips empty and foreign urls without calling Storage', async () => {
      const { remove, storage } = storageMock();
      const service = new PetPhotoService({ storage } as any);

      await service.removeStoredPhotos([
        '',
        null,
        'https://example.com/cat.png',
      ]);

      expect(remove).not.toHaveBeenCalled();
    });

    it('removeStoredPhotos logs a Storage failure and does not throw', async () => {
      const { storage } = storageMock({ error: { message: 'boom' } });
      const service = new PetPhotoService({ storage } as any);

      await expect(service.removeStoredPhotos([urlA])).resolves.toBeUndefined();
    });

    it('deletePhoto removes the file after the row is gone', async () => {
      const rows = chain({ data: [{ url: urlA }], error: null });
      const { remove, storage } = storageMock();
      const supabase = {
        from: vi.fn().mockReturnValue(rows),
        storage,
      } as any;

      await new PetPhotoService(supabase).deletePhoto('photo-1');

      expect(rows.select).toHaveBeenCalledWith('url');
      expect(remove).toHaveBeenCalledWith(['shelter-1/pet-1/111.webp']);
    });

    it('deletePhoto keeps the file when the database delete fails', async () => {
      const rows = chain({ data: null, error: { message: 'denied' } });
      const { remove, storage } = storageMock();
      const supabase = {
        from: vi.fn().mockReturnValue(rows),
        storage,
      } as any;

      await expect(
        new PetPhotoService(supabase).deletePhoto('photo-1')
      ).rejects.toThrow(/Failed to delete pet photo/);
      expect(remove).not.toHaveBeenCalled();
    });

    it('deletePhoto does not report failure when the file removal fails', async () => {
      const rows = chain({ data: [{ url: urlA }], error: null });
      const { storage } = storageMock({ error: { message: 'boom' } });
      const supabase = {
        from: vi.fn().mockReturnValue(rows),
        storage,
      } as any;

      await expect(
        new PetPhotoService(supabase).deletePhoto('photo-1')
      ).resolves.toBeUndefined();
    });

    it('deletePhoto on a legacy id reads photo_url first, then removes that file', async () => {
      const pets = chain({ data: { photo_url: urlA }, error: null });
      const { remove, storage } = storageMock();
      const supabase = {
        from: vi.fn().mockReturnValue(pets),
        storage,
      } as any;

      await new PetPhotoService(supabase).deletePhoto(
        legacyPetPhotoId('pet-1')
      );

      expect(pets.update).toHaveBeenCalledWith({ photo_url: null });
      expect(remove).toHaveBeenCalledWith(['shelter-1/pet-1/111.webp']);
    });
  });
});
