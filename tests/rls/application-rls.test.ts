/**
 * RLS: Anti-Ghosting MVP (applications, adopter_profiles, status RPCs)
 *
 * Security contract (Constitution Principle III — Applicant Data Is a Trust):
 * - adopters see/insert only their own applications; no direct status writes
 * - shelter staff see their shelter's applications; advance ONLY via RPC
 * - status transitions are validated in Postgres, not the client
 * - adopter_profiles are strictly own-row
 *
 * Follows the tests/rls/* pattern: skips without a live Supabase +
 * SUPABASE_SERVICE_ROLE_KEY. Run via `pnpm test:rls`.
 * Uses the demo seed reference data (supabase/seed-rescue-demo.sql):
 * shelter 2222...01 with available pets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAuthenticatedClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  type TestUser,
} from '../fixtures/test-users';

const SHELTER_ID = '22222222-2222-2222-2222-222222222201';
const PET_BISCUIT = '44444444-4444-4444-4444-444444444401';
const PET_PEPPER = '44444444-4444-4444-4444-444444444402';

const SNAPSHOT = {
  full_name: 'RLS Test Adopter',
  housing_type: 'own_house',
  has_yard: true,
  household_adults: 1,
  household_children: 0,
};

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Applications & Status RPCs [${RLS_SKIP_REASON}]`,
  () => {
    let adopter: TestUser;
    let stranger: TestUser;
    let staff: TestUser;
    let applicationId: string;

    beforeAll(async () => {
      adopter = await createTestUser(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      stranger = await createTestUser(
        'rls-app-stranger@example.com',
        'RlsTestPassword123!'
      );
      staff = await createTestUser(
        'rls-app-staff@example.com',
        'RlsTestPassword123!'
      );

      // Grant shelter membership via service role (no client write path exists)
      const service = createServiceClient();
      await service.from('shelter_members').insert({
        shelter_id: SHELTER_ID,
        user_id: staff.id,
        role: 'staff',
      });
    }, 60000);

    afterAll(async () => {
      const service = createServiceClient();
      if (applicationId) {
        await service.from('applications').delete().eq('id', applicationId);
      }
      await service.from('shelter_members').delete().eq('user_id', staff.id);
      await deleteTestUser(adopter.id);
      await deleteTestUser(stranger.id);
      await deleteTestUser(staff.id);
    }, 60000);

    it('adopter can submit an application for an available pet', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { data, error } = await client
        .from('applications')
        .insert({
          adopter_id: adopter.id,
          pet_id: PET_BISCUIT,
          shelter_id: SHELTER_ID,
          profile_snapshot: SNAPSHOT,
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data!.status).toBe('submitted');
      applicationId = data!.id;
    });

    it('the submit trigger wrote the initial history row, visible to the adopter', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { data, error } = await client
        .from('application_status_history')
        .select('*')
        .eq('application_id', applicationId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].to_status).toBe('submitted');
    });

    it('adopter cannot submit an application impersonating someone else', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { error } = await client.from('applications').insert({
        adopter_id: stranger.id,
        pet_id: PET_PEPPER,
        shelter_id: SHELTER_ID,
        profile_snapshot: SNAPSHOT,
      });

      expect(error).not.toBeNull();
    });

    it('a stranger sees no applications (tenant isolation)', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-stranger@example.com',
        'RlsTestPassword123!'
      );
      const { data, error } = await client
        .from('applications')
        .select('*')
        .eq('id', applicationId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('adopter cannot change status with a direct UPDATE (no policy)', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { data } = await client
        .from('applications')
        .update({ status: 'approved' })
        .eq('id', applicationId)
        .select('*');

      // No UPDATE policy → zero rows affected, status unchanged
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await client
        .from('applications')
        .select('status')
        .eq('id', applicationId)
        .single();
      expect(check!.status).toBe('submitted');
    });

    it('adopter cannot advance status via the staff RPC', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { error } = await client.rpc('advance_application_status', {
        p_application_id: applicationId,
        p_to_status: 'under_review',
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('not authorized');
    });

    it('shelter staff sees the application', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-staff@example.com',
        'RlsTestPassword123!'
      );
      const { data, error } = await client
        .from('applications')
        .select('*')
        .eq('id', applicationId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('staff RPC rejects illegal transitions', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-staff@example.com',
        'RlsTestPassword123!'
      );
      const { error } = await client.rpc('advance_application_status', {
        p_application_id: applicationId,
        p_to_status: 'home_visit', // submitted -> home_visit is illegal
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('illegal transition');
    });

    it('staff advances legally; note lands in adopter-visible history', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-staff@example.com',
        'RlsTestPassword123!'
      );
      const { data, error } = await client.rpc('advance_application_status', {
        p_application_id: applicationId,
        p_to_status: 'under_review',
        p_note: 'Reading it now!',
      });

      expect(error).toBeNull();
      expect((data as { status: string }).status).toBe('under_review');

      const adopterClient = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { data: history } = await adopterClient
        .from('application_status_history')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at');
      expect(history).toHaveLength(2);
      expect(history![1].note).toBe('Reading it now!');
    });

    it('adopter withdraws own application; terminal state locks', async () => {
      const client = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      const { data, error } = await client.rpc('withdraw_application', {
        p_application_id: applicationId,
      });

      expect(error).toBeNull();
      expect((data as { status: string }).status).toBe('withdrawn');

      const { error: again } = await client.rpc('withdraw_application', {
        p_application_id: applicationId,
      });
      expect(again).not.toBeNull();
      expect(again!.message).toContain('cannot withdraw');
    });

    it('adopter profiles are strictly own-row', async () => {
      const adopterClient = await createAuthenticatedClient(
        'rls-app-adopter@example.com',
        'RlsTestPassword123!'
      );
      await adopterClient.from('adopter_profiles').upsert({
        id: adopter.id,
        full_name: 'RLS Test Adopter',
        housing_type: 'own_house',
      });

      const strangerClient = await createAuthenticatedClient(
        'rls-app-stranger@example.com',
        'RlsTestPassword123!'
      );
      const { data } = await strangerClient
        .from('adopter_profiles')
        .select('*')
        .eq('id', adopter.id);

      expect(data).toHaveLength(0);

      // Cleanup the profile row
      const service = createServiceClient();
      await service.from('adopter_profiles').delete().eq('id', adopter.id);
    });
  }
);
