import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MAX_PET_PHOTOS, PetPhotoService } from './pet-photo-service';

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
    const supabase = { from: vi.fn() } as any;
    const service = new PetPhotoService(supabase);
    await expect(service.reorderPhotos(petId, ids)).rejects.toThrow(
      `Maximum ${MAX_PET_PHOTOS} photos per pet`
    );
  });
});
