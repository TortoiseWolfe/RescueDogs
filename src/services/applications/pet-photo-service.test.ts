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
});
