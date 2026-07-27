import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShelterPetService } from './shelter-pet-service';

function mockFrom(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of [
    'select',
    'insert',
    'update',
    'eq',
    'order',
    'maybeSingle',
    'single',
  ]) {
    builder[m] = vi.fn(self);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = undefined;
  // listPets awaits the builder directly via order() returning thenable-like —
  // make order resolve
  builder.order = vi.fn().mockResolvedValue(result);
  return builder;
}

describe('ShelterPetService', () => {
  const shelterId = '22222222-2222-2222-2222-222222222201';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists pets for a shelter', async () => {
    const pets = [
      {
        id: 'pet-1',
        shelter_id: shelterId,
        name: 'Biscuit',
        species: 'dog',
        breed: null,
        sex: null,
        age_years: null,
        size: null,
        photo_url: null,
        status: 'available',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const from = mockFrom({ data: pets, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    const result = await service.listPets(shelterId);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Biscuit');
    expect(supabase.from).toHaveBeenCalledWith('pets');
  });

  it('creates a pet with trimmed name', async () => {
    const created = {
      id: 'pet-2',
      shelter_id: shelterId,
      name: 'Noodle',
      species: 'dog',
      breed: null,
      sex: null,
      age_years: null,
      size: null,
      photo_url: null,
      status: 'available',
      created_at: '2026-01-01T00:00:00Z',
    };
    const from = mockFrom({ data: created, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    const result = await service.createPet(shelterId, {
      name: '  Noodle  ',
      species: 'dog',
    });
    expect(result.name).toBe('Noodle');
    expect(from.insert).toHaveBeenCalled();
  });
});
