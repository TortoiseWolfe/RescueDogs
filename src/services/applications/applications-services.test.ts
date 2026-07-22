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
    const pets = [{ id: PET_ID, name: 'Biscuit', status: 'available' }];
    const builder = createQueryBuilder({ data: pets, error: null });
    mock.from.mockReturnValue(builder);

    const result = await service.getAvailablePets();

    expect(mock.from).toHaveBeenCalledWith('pets');
    expect(builder.eq).toHaveBeenCalledWith('status', 'available');
    expect(builder.order).toHaveBeenCalledWith('name');
    expect(result).toEqual(pets);
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
      data: {
        shelter_id: SHELTER_ID,
        role: 'manager',
        shelters: { name: 'Second Chance Rescue' },
      },
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
    });
  });

  it('getMyShelterMembership returns null for non-staff', async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    mock.from.mockReturnValue(builder);

    expect(await service.getMyShelterMembership(USER_ID)).toBeNull();
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
