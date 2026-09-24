/**
 * Unit tests: ApplicationService + ShelterApplicationService
 * Mocked Supabase client (constructor-injected) — no network dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApplicationService } from './application-service';
import { ShelterApplicationService } from './shelter-application-service';

const USER_ID = '33333333-3333-3333-3333-333333333301';
const STAFF_ID = '33333333-3333-3333-3333-333333333302';
const SHELTER_ID = '22222222-2222-2222-2222-222222222201';
const PET_ID = '44444444-4444-4444-4444-444444444401';
const APP_ID = '55555555-5555-5555-5555-555555555501';

type QueryResult = { data: unknown; error: unknown };

/** Thenable query-builder mock: every chain method returns itself. */
const createQueryBuilder = (result: QueryResult) => {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: unknown;
  } = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'contains',
    'order',
    'limit',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: (r: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
};

const createMockClient = () => {
  const from = vi.fn();
  const rpc = vi.fn();
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, from, rpc };
};

describe('ApplicationService', () => {
  let mock: ReturnType<typeof createMockClient>;
  let service: ApplicationService;

  beforeEach(() => {
    mock = createMockClient();
    service = new ApplicationService(mock.client);
  });

  it('getAvailablePets queries available pets ordered by name', async () => {
    const pets = [
      {
        id: PET_ID,
        name: 'Biscuit',
        status: 'available',
        shelters: { name: 'Second Chance Rescue' },
      },
    ];
    const builder = createQueryBuilder({ data: pets, error: null });
    mock.from.mockReturnValue(builder);

    const result = await service.getAvailablePets();

    expect(mock.from).toHaveBeenCalledWith('pets');
    expect(builder.select).toHaveBeenCalledWith('*, shelters(name)');
    expect(builder.eq).toHaveBeenCalledWith('status', 'available');
    expect(builder.order).toHaveBeenCalledWith('name');
    expect(result).toEqual(pets);
  });

  it('getAvailablePets can filter by species', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.getAvailablePets('cat');

    expect(builder.eq).toHaveBeenCalledWith('status', 'available');
    expect(builder.eq).toHaveBeenCalledWith('species', 'cat');
  });

  it('getBrowsePets filters available pets by species with shelter embed', async () => {
    const pets = [
      {
        id: PET_ID,
        name: 'Miso',
        species: 'cat',
        status: 'available',
        shelters: {
          name: 'Second Chance',
          city: 'Asheville',
          state: 'NC',
          zip: '28801',
        },
      },
    ];
    const builder = createQueryBuilder({ data: pets, error: null });
    mock.from.mockReturnValue(builder);

    const result = await service.getBrowsePets('cat');

    expect(mock.from).toHaveBeenCalledWith('pets');
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining(
        'shelters(name, city, state, zip, transports, transport_states, transport_note)'
      )
    );
    expect(builder.eq).toHaveBeenCalledWith('status', 'available');
    expect(builder.eq).toHaveBeenCalledWith('species', 'cat');
    expect(result).toEqual(pets);
  });

  it('getBrowsePets joins shelters and filters by state (#111)', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.getBrowsePets('dog', { state: ' nc ' });

    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining(
        'shelters!inner(name, city, state, zip, transports, transport_states, transport_note)'
      )
    );
    expect(builder.eq).toHaveBeenCalledWith('shelters.state', 'NC');
  });

  it('getBrowsePets adds rescues that transport to the state (#331)', async () => {
    const localPet = {
      id: PET_ID,
      name: 'Pickle',
      transportable: true,
      shelters: { name: 'Newark Pet Alliance', state: 'NJ' },
    };
    const transportedPet = {
      id: '44444444-4444-4444-4444-444444444402',
      name: 'Aspen',
      transportable: true,
      shelters: { name: 'Sunnyside Street Dogs Rescue', state: 'TX' },
    };
    const localBuilder = createQueryBuilder({ data: [localPet], error: null });
    const transportBuilder = createQueryBuilder({
      data: [transportedPet],
      error: null,
    });
    mock.from
      .mockReturnValueOnce(localBuilder)
      .mockReturnValueOnce(transportBuilder);

    const result = await service.getBrowsePets('dog', { state: 'NJ' });

    expect(transportBuilder.eq).toHaveBeenCalledWith('transportable', true);
    expect(transportBuilder.eq).toHaveBeenCalledWith(
      'shelters.transports',
      true
    );
    expect(transportBuilder.contains).toHaveBeenCalledWith(
      'shelters.transport_states',
      ['NJ']
    );
    // Sorted by name, de-duplicated across both round trips.
    expect(result.map((pet) => pet.name)).toEqual(['Aspen', 'Pickle']);
  });

  it('getBrowsePets derives the transport state from the ZIP (#331)', async () => {
    const localBuilder = createQueryBuilder({ data: [], error: null });
    const transportBuilder = createQueryBuilder({ data: [], error: null });
    mock.from
      .mockReturnValueOnce(localBuilder)
      .mockReturnValueOnce(transportBuilder);

    await service.getBrowsePets('dog', { centerZip: '07102' });

    expect(transportBuilder.contains).toHaveBeenCalledWith(
      'shelters.transport_states',
      ['NJ']
    );
    // The base query keeps its old behaviour: a ZIP alone never narrows by state.
    expect(localBuilder.eq).not.toHaveBeenCalledWith('shelters.state', 'NJ');
  });

  it('getBrowsePets skips the transport query when opted out (#331)', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.getBrowsePets('dog', {
      state: 'NJ',
      includeTransport: false,
    });

    expect(mock.from).toHaveBeenCalledTimes(1);
    expect(builder.contains).not.toHaveBeenCalled();
  });

  it('listBrowseShelters returns distinct shelters with available pets (#280)', async () => {
    const rows = [
      {
        shelter_id: SHELTER_ID,
        shelters: { id: SHELTER_ID, name: 'Second Chance' },
      },
    ];
    const builder = createQueryBuilder({ data: rows, error: null });
    mock.from.mockReturnValue(builder);

    const result = await service.listBrowseShelters('dog');

    expect(mock.from).toHaveBeenCalledWith('pets');
    expect(result).toEqual([{ id: SHELTER_ID, name: 'Second Chance' }]);
  });

  it('getBrowsePets filters by shelter id (#274)', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.getBrowsePets('dog', {
      shelterId: ' 22222222-2222-2222-2222-222222222201 ',
    });

    expect(builder.eq).toHaveBeenCalledWith(
      'shelter_id',
      '22222222-2222-2222-2222-222222222201'
    );
  });

  it('getBrowsePet loads available pet with gallery when present (#274)', async () => {
    const pet = {
      id: PET_ID,
      name: 'Biscuit',
      species: 'dog',
      status: 'available',
      shelters: {
        name: 'Second Chance',
        city: 'Asheville',
        state: 'NC',
        zip: '28801',
      },
    };
    const petBuilder = createQueryBuilder({ data: pet, error: null });
    const photosBuilder = createQueryBuilder({
      data: [{ url: 'https://example.com/a.webp', sort_order: 0 }],
      error: null,
    });
    mock.from.mockImplementation((table: string) => {
      if (table === 'pets') return petBuilder;
      if (table === 'pet_photos') return photosBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await service.getBrowsePet(PET_ID);

    expect(mock.from).toHaveBeenCalledWith('pets');
    expect(mock.from).toHaveBeenCalledWith('pet_photos');
    expect(petBuilder.eq).toHaveBeenCalledWith('id', PET_ID);
    expect(petBuilder.eq).toHaveBeenCalledWith('status', 'available');
    expect(result?.pet_photos).toHaveLength(1);
    expect(result).toMatchObject(pet);
  });

  it('getBrowsePet returns pet without gallery when pet_photos unavailable (#274)', async () => {
    const pet = {
      id: PET_ID,
      name: 'Biscuit',
      species: 'dog',
      status: 'available',
      photo_url: 'https://example.com/legacy.jpg',
      shelters: { name: 'Second Chance', city: null, state: null, zip: null },
    };
    const petBuilder = createQueryBuilder({ data: pet, error: null });
    const photosBuilder = createQueryBuilder({
      data: null,
      error: { message: 'relation pet_photos does not exist' },
    });
    mock.from.mockImplementation((table: string) => {
      if (table === 'pets') return petBuilder;
      if (table === 'pet_photos') return photosBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await service.getBrowsePet(PET_ID);

    expect(result).toMatchObject(pet);
    expect(result?.pet_photos).toBeUndefined();
  });

  it('getAdopterProfile returns null when no profile exists', async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    mock.from.mockReturnValue(builder);

    const result = await service.getAdopterProfile(USER_ID);

    expect(mock.from).toHaveBeenCalledWith('adopter_profiles');
    expect(builder.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(result).toBeNull();
  });

  it('submitApplication upserts the profile, then inserts with snapshot', async () => {
    const profile = {
      full_name: 'Dana Adopter',
      housing_type: 'own_house',
    } as never;
    const insertedApp = { id: APP_ID, status: 'submitted' };

    const profileBuilder = createQueryBuilder({ data: null, error: null });
    const appBuilder = createQueryBuilder({ data: insertedApp, error: null });
    mock.from.mockImplementation((table: string) =>
      table === 'adopter_profiles' ? profileBuilder : appBuilder
    );

    const result = await service.submitApplication(USER_ID, {
      petId: PET_ID,
      shelterId: SHELTER_ID,
      profile,
      whyThisPet: 'Best dog',
    });

    expect(profileBuilder.upsert).toHaveBeenCalledWith(
      { id: USER_ID, full_name: 'Dana Adopter', housing_type: 'own_house' },
      { onConflict: 'id' }
    );
    expect(appBuilder.insert).toHaveBeenCalledWith({
      adopter_id: USER_ID,
      pet_id: PET_ID,
      shelter_id: SHELTER_ID,
      profile_snapshot: profile,
      why_this_pet: 'Best dog',
    });
    expect(result).toEqual(insertedApp);
  });

  it('submitApplication surfaces profile upsert errors and skips the insert', async () => {
    const failure = { message: 'permission denied' };
    const profileBuilder = createQueryBuilder({ data: null, error: failure });
    mock.from.mockReturnValue(profileBuilder);

    await expect(
      service.submitApplication(USER_ID, {
        petId: PET_ID,
        shelterId: SHELTER_ID,
        profile: {} as never,
      })
    ).rejects.toEqual(failure);
    expect(profileBuilder.insert).not.toHaveBeenCalled();
  });

  it('getMyApplications scopes to the adopter, newest first', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.getMyApplications(USER_ID);

    expect(builder.eq).toHaveBeenCalledWith('adopter_id', USER_ID);
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
  });

  it('withdrawApplication calls the Postgres RPC', async () => {
    mock.rpc.mockResolvedValue({
      data: { id: APP_ID, status: 'withdrawn' },
      error: null,
    });

    const result = await service.withdrawApplication(APP_ID);

    expect(mock.rpc).toHaveBeenCalledWith('withdraw_application', {
      p_application_id: APP_ID,
    });
    expect(result.status).toBe('withdrawn');
  });

  it('withdrawApplication surfaces RPC errors (terminal guard)', async () => {
    const failure = { message: 'cannot withdraw a withdrawn application' };
    mock.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(service.withdrawApplication(APP_ID)).rejects.toEqual(failure);
  });
});

describe('ShelterApplicationService', () => {
  let mock: ReturnType<typeof createMockClient>;
  let service: ShelterApplicationService;

  beforeEach(() => {
    mock = createMockClient();
    service = new ShelterApplicationService(mock.client);
  });

  it('getMyShelterMembership returns membership with shelter name', async () => {
    const builder = createQueryBuilder({
      data: [
        {
          shelter_id: SHELTER_ID,
          role: 'manager',
          shelters: { name: 'Second Chance Rescue' },
        },
      ],
      error: null,
    });
    mock.from.mockReturnValue(builder);

    const result = await service.getMyShelterMembership(STAFF_ID);

    expect(mock.from).toHaveBeenCalledWith('shelter_members');
    expect(builder.eq).toHaveBeenCalledWith('user_id', STAFF_ID);
    expect(result).toEqual({
      shelterId: SHELTER_ID,
      shelterName: 'Second Chance Rescue',
      role: 'manager',
      transports: false,
      transportStates: [],
    });
  });

  it('getMyShelterMembership returns null for non-staff', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    expect(await service.getMyShelterMembership(USER_ID)).toBeNull();
  });

  it('listMyShelterMemberships returns every membership sorted by name (#261)', async () => {
    const otherId = '22222222-2222-2222-2222-222222222299';
    const builder = createQueryBuilder({
      data: [
        {
          shelter_id: otherId,
          role: 'staff',
          shelters: { name: 'Zebra Rescue' },
        },
        {
          shelter_id: SHELTER_ID,
          role: 'manager',
          shelters: {
            name: 'Alpha Rescue',
            transports: true,
            transport_states: ['nj', 'NJ', 'ny'],
          },
        },
      ],
      error: null,
    });
    mock.from.mockReturnValue(builder);

    const result = await service.listMyShelterMemberships(STAFF_ID);

    expect(result).toEqual([
      {
        shelterId: SHELTER_ID,
        shelterName: 'Alpha Rescue',
        role: 'manager',
        transports: true,
        transportStates: ['NJ', 'NY'],
      },
      {
        shelterId: otherId,
        shelterName: 'Zebra Rescue',
        role: 'staff',
        transports: false,
        transportStates: [],
      },
    ]);
  });

  it('listMyShelterMemberships throws on query error (#285)', async () => {
    const builder = createQueryBuilder({
      data: null,
      error: { message: 'jwt expired', code: 'PGRST301' },
    });
    mock.from.mockReturnValue(builder);

    await expect(
      service.listMyShelterMemberships(STAFF_ID)
    ).rejects.toMatchObject({ message: 'jwt expired' });
  });

  it('getMyShelterMembership soft-fails to null on query error (#285)', async () => {
    const builder = createQueryBuilder({
      data: null,
      error: { message: 'network', code: 'PGRST000' },
    });
    mock.from.mockReturnValue(builder);

    expect(await service.getMyShelterMembership(STAFF_ID)).toBeNull();
  });

  it('createMyShelter calls the RPC with p_ argument names (#218)', async () => {
    mock.rpc.mockResolvedValue({
      data: SHELTER_ID,
      error: null,
    });

    const id = await service.createMyShelter({
      name: 'Happy Tails',
      city: 'Asheville',
      state: 'NC',
      zip: '28801',
      contactEmail: 'hello@example.com',
    });

    expect(mock.rpc).toHaveBeenCalledWith('create_my_shelter', {
      p_name: 'Happy Tails',
      p_city: 'Asheville',
      p_state: 'NC',
      p_zip: '28801',
      p_contact_email: 'hello@example.com',
      p_transports: false,
      p_transport_states: [],
      p_transport_note: null,
    });
    expect(id).toBe(SHELTER_ID);
  });

  it('createMyShelter forwards normalized transport settings (#331)', async () => {
    mock.rpc.mockResolvedValue({ data: SHELTER_ID, error: null });

    await service.createMyShelter({
      name: 'Sunnyside Street Dogs Rescue',
      state: 'TX',
      transports: true,
      transportStates: [' nj ', 'NJ', 'ny', 'ZZ'],
      transportNote: 'Transport fee $300.',
    });

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_my_shelter',
      expect.objectContaining({
        p_transports: true,
        p_transport_states: ['NJ', 'NY'],
        p_transport_note: 'Transport fee $300.',
      })
    );
  });

  it('updateMyShelter calls the manager-only RPC (#331)', async () => {
    mock.rpc.mockResolvedValue({
      data: {
        id: SHELTER_ID,
        name: 'Sunnyside Street Dogs Rescue',
        city: 'Houston',
        state: 'TX',
        zip: '77002',
        contact_email: null,
        transports: true,
        transport_states: ['nj'],
        transport_note: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    const result = await service.updateMyShelter({
      shelterId: SHELTER_ID,
      name: 'Sunnyside Street Dogs Rescue',
      city: 'Houston',
      state: 'TX',
      zip: '77002',
      transports: true,
      transportStates: ['NJ'],
    });

    expect(mock.rpc).toHaveBeenCalledWith('update_my_shelter', {
      p_shelter_id: SHELTER_ID,
      p_name: 'Sunnyside Street Dogs Rescue',
      p_city: 'Houston',
      p_state: 'TX',
      p_zip: '77002',
      p_contact_email: null,
      p_transports: true,
      p_transport_states: ['NJ'],
      p_transport_note: null,
    });
    expect(result.transport_states).toEqual(['NJ']);
  });

  it('updateMyShelter drops transport states when transport is off (#331)', async () => {
    mock.rpc.mockResolvedValue({
      data: {
        id: SHELTER_ID,
        name: 'Second Chance Rescue',
        transports: false,
        transport_states: [],
      },
      error: null,
    });

    await service.updateMyShelter({
      shelterId: SHELTER_ID,
      name: 'Second Chance Rescue',
      transports: false,
      transportStates: ['NJ'],
    });

    expect(mock.rpc).toHaveBeenCalledWith(
      'update_my_shelter',
      expect.objectContaining({
        p_transports: false,
        p_transport_states: [],
      })
    );
  });

  it('updateMyShelter maps RPC refusals to codes, longest match first (#331)', async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not_a_manager' },
    });

    await expect(
      service.updateMyShelter({ shelterId: SHELTER_ID, name: 'Nope' })
    ).rejects.toMatchObject({ code: 'not_a_manager' });

    // invalid_state is a substring of invalid_transport_states.
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_transport_states' },
    });

    await expect(
      service.updateMyShelter({ shelterId: SHELTER_ID, name: 'Nope' })
    ).rejects.toMatchObject({ code: 'invalid_transport_states' });
  });

  it('getShelter normalizes transport fields (#331)', async () => {
    const builder = createQueryBuilder({
      data: {
        id: SHELTER_ID,
        name: 'Sunnyside Street Dogs Rescue',
        transports: true,
        transport_states: ['ny', 'nj', 'nj'],
      },
      error: null,
    });
    mock.from.mockReturnValue(builder);

    const result = await service.getShelter(SHELTER_ID);

    expect(mock.from).toHaveBeenCalledWith('shelters');
    expect(builder.eq).toHaveBeenCalledWith('id', SHELTER_ID);
    expect(result?.transport_states).toEqual(['NJ', 'NY']);
  });

  it('createMyShelter maps already_a_member to AlreadyAMemberError (#218)', async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'already_a_member' },
    });

    await expect(
      service.createMyShelter({ name: 'Happy Tails' })
    ).rejects.toMatchObject({ name: 'AlreadyAMemberError' });
  });

  it('addStaffByEmail calls the RPC with p_ argument names (#220/#261)', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: null });

    await service.addStaffByEmail('volunteer@example.com', SHELTER_ID);

    expect(mock.rpc).toHaveBeenCalledWith('add_shelter_staff_by_email', {
      p_email: 'volunteer@example.com',
      p_shelter_id: SHELTER_ID,
    });
  });

  it.each([
    ['user_not_found', 'user_not_found'],
    ['user_not_confirmed', 'user_not_confirmed'],
    ['not_a_manager', 'not_a_manager'],
    ['invalid_email', 'invalid_email'],
    ['invalid_shelter', 'invalid_shelter'],
  ])(
    'addStaffByEmail maps the %s RPC failure to a typed code (#220)',
    async (message, code) => {
      mock.rpc.mockResolvedValue({
        data: null,
        error: { message: `... ${message} ...` },
      });

      await expect(
        service.addStaffByEmail('volunteer@example.com', SHELTER_ID)
      ).rejects.toMatchObject({ name: 'AddStaffError', code });
    }
  );

  it('addStaffByEmail falls back to unknown for unrecognised failures (#220)', async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'connection reset by peer' },
    });

    await expect(
      service.addStaffByEmail('volunteer@example.com', SHELTER_ID)
    ).rejects.toMatchObject({ name: 'AddStaffError', code: 'unknown' });
  });

  it('listShelterApplications filters by status when provided', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.listShelterApplications(SHELTER_ID, 'submitted');

    expect(builder.eq).toHaveBeenCalledWith('shelter_id', SHELTER_ID);
    expect(builder.eq).toHaveBeenCalledWith('status', 'submitted');
    expect(builder.order).toHaveBeenCalledWith('status_changed_at', {
      ascending: false,
    });
  });

  it('listShelterApplications omits the status filter by default', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(builder);

    await service.listShelterApplications(SHELTER_ID);

    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('shelter_id', SHELTER_ID);
  });

  it('advanceStatus calls the RPC with note', async () => {
    mock.rpc.mockResolvedValue({
      data: { id: APP_ID, status: 'under_review' },
      error: null,
    });

    const result = await service.advanceStatus(
      APP_ID,
      'under_review',
      'In review!'
    );

    expect(mock.rpc).toHaveBeenCalledWith('advance_application_status', {
      p_application_id: APP_ID,
      p_to_status: 'under_review',
      p_note: 'In review!',
    });
    expect(result.status).toBe('under_review');
  });

  it('advanceStatus surfaces illegal-transition errors', async () => {
    const failure = {
      message: 'illegal transition submitted -> home_visit',
    };
    mock.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(service.advanceStatus(APP_ID, 'home_visit')).rejects.toEqual(
      failure
    );
  });

  it('advanceStatus surfaces pet-already-approved errors (#34)', async () => {
    const failure = {
      message: 'pet already has an approved application',
    };
    mock.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(service.advanceStatus(APP_ID, 'approved')).rejects.toEqual(
      failure
    );
  });

  it('finalizeAdoption calls the finalize_adoption RPC (#35)', async () => {
    mock.rpc.mockResolvedValue({
      data: { id: PET_ID, status: 'adopted' },
      error: null,
    });

    await service.finalizeAdoption(APP_ID);

    expect(mock.rpc).toHaveBeenCalledWith('finalize_adoption', {
      p_application_id: APP_ID,
    });
  });

  it('finalizeAdoption surfaces RPC errors (#35)', async () => {
    const failure = {
      message: 'only approved applications can be finalized',
    };
    mock.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(service.finalizeAdoption(APP_ID)).rejects.toEqual(failure);
  });

  it('getApplicantEmail returns email from staff-only RPC (#66)', async () => {
    mock.rpc.mockResolvedValue({
      data: 'adopter@example.com',
      error: null,
    });

    await expect(service.getApplicantEmail(APP_ID)).resolves.toBe(
      'adopter@example.com'
    );
    expect(mock.rpc).toHaveBeenCalledWith('get_application_applicant_email', {
      p_application_id: APP_ID,
    });
  });

  it('getApplicantEmail returns null when RPC fails (#66)', async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not authorized' },
    });

    await expect(service.getApplicantEmail(APP_ID)).resolves.toBeNull();
  });
});
