import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShelterPetService } from './shelter-pet-service';

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
        notes: null,
        video_url: null,
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
      notes: 'Pocket rocket with a soft heart.',
      created_at: '2026-01-01T00:00:00Z',
    };
    const from = mockFrom({ data: created, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    const result = await service.createPet(shelterId, {
      name: '  Noodle  ',
      species: 'dog',
      notes: '  Pocket rocket with a soft heart.  ',
    });
    expect(result.name).toBe('Noodle');
    expect(from.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        shelter_id: shelterId,
        name: 'Noodle',
        notes: 'Pocket rocket with a soft heart.',
      })
    );
  });

  it('updates a pet with a trimmed patch payload', async () => {
    const updated = {
      id: 'pet-2',
      shelter_id: shelterId,
      name: 'Noodle',
      species: 'dog',
      breed: null,
      sex: null,
      age_years: null,
      size: null,
      photo_url: null,
      status: 'adopted',
      notes: 'Now fully house-trained.',
      created_at: '2026-01-01T00:00:00Z',
    };
    const from = mockFrom({ data: updated, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    const result = await service.updatePet('pet-2', {
      name: '  Noodle  ',
      notes: '  Now fully house-trained.  ',
      breed: '   ',
    });
    expect(result.name).toBe('Noodle');
    expect(from.update).toHaveBeenCalledWith({
      name: 'Noodle',
      notes: 'Now fully house-trained.',
      breed: null,
    });
    expect(from.eq).toHaveBeenCalledWith('id', 'pet-2');
  });

  it('does not filter on status when no expectedStatus is given (#354)', async () => {
    const from = mockFrom({ data: { id: 'pet-2' }, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    await service.updatePet('pet-2', { name: 'Noodle' });
    expect(from.eq).toHaveBeenCalledTimes(1);
    expect(from.update).toHaveBeenCalledWith({ name: 'Noodle' });
  });

  it('only overwrites status if it is still the loaded value (#354)', async () => {
    const from = mockFrom({ data: { id: 'pet-2' }, error: null });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    await service.updatePet(
      'pet-2',
      { status: 'available' },
      { expectedStatus: 'pending' }
    );
    expect(from.eq).toHaveBeenCalledWith('id', 'pet-2');
    expect(from.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('reports a status changed elsewhere instead of overwriting it (#354)', async () => {
    const from = mockFrom({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    await expect(
      service.updatePet(
        'pet-2',
        { status: 'available' },
        { expectedStatus: 'pending' }
      )
    ).rejects.toThrow(/changed elsewhere/);
  });

  it('explains the approved-application lock from the DB (#354)', async () => {
    const from = mockFrom({
      data: null,
      error: {
        code: '23514',
        message: 'pet_status_locked_by_approved_application',
      },
    });
    const supabase = { from: vi.fn().mockReturnValue(from) } as any;
    const service = new ShelterPetService(supabase);
    await expect(
      service.updatePet(
        'pet-2',
        { status: 'available' },
        { expectedStatus: 'adopted' }
      )
    ).rejects.toThrow(/approved application/);
  });

  it('returns application count for a pet (#223)', async () => {
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = vi.fn(self);
    builder.eq = vi.fn().mockResolvedValue({ count: 3, error: null });
    const supabase = { from: vi.fn().mockReturnValue(builder) } as any;
    const service = new ShelterPetService(supabase);
    const count = await service.getPetApplicationCount('pet-2');
    expect(count).toBe(3);
    expect(supabase.from).toHaveBeenCalledWith('applications');
    expect(builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(builder.eq).toHaveBeenCalledWith('pet_id', 'pet-2');
  });

  it('counts only still-open applications (#339)', async () => {
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = vi.fn(self);
    builder.eq = vi.fn(self);
    builder.in = vi.fn().mockResolvedValue({ count: 1, error: null });
    const supabase = { from: vi.fn().mockReturnValue(builder) } as any;
    const service = new ShelterPetService(supabase);
    const count = await service.getPetOpenApplicationCount('pet-2');
    expect(count).toBe(1);
    expect(builder.in).toHaveBeenCalledWith('status', [
      'submitted',
      'under_review',
      'reference_check',
      'home_visit',
    ]);
  });

  it('deletes a pet by id (#223)', async () => {
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.delete = vi.fn(self);
    builder.eq = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue(builder) } as any;
    const service = new ShelterPetService(supabase);
    await service.deletePet('pet-2');
    expect(supabase.from).toHaveBeenCalledWith('pets');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'pet-2');
  });

  it('throws when deletePet fails (#223)', async () => {
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.delete = vi.fn(self);
    builder.eq = vi.fn().mockResolvedValue({
      error: { message: 'permission denied' },
    });
    const supabase = { from: vi.fn().mockReturnValue(builder) } as any;
    const service = new ShelterPetService(supabase);
    await expect(service.deletePet('pet-2')).rejects.toThrow(
      /Failed to delete pet: permission denied/
    );
  });
});
