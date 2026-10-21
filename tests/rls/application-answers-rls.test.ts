/**
 * RLS: Configurable application storage (#337, phase 1)
 *
 * Security contract (Constitution Principle III — Applicant Data Is a Trust):
 * - the question bank is public to read and has no client write path
 * - adopter_answers are strictly own-row; shelter staff never read them
 * - a rescue's question choices have no table write path; managers replace
 *   them only through set_shelter_application_questions
 * - applications.answers_snapshot is built by the database at submit time
 *   from the locked core plus the questions that rescue shows; a client
 *   cannot forge it, and later changes never rewrite a submitted one
 *
 * Follows the tests/rls/* pattern: skips without a live Supabase +
 * SUPABASE_SERVICE_ROLE_KEY. Run via `pnpm test:rls`.
 * Uses its own throwaway shelter so the demo rescue's choices never change.
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

const SHELTER_ID = '55555555-5555-5555-5555-5555555555a1';
const DOG_1 = '44444444-4444-4444-4444-4444444444c1';
const DOG_2 = '44444444-4444-4444-4444-4444444444c2';
const CAT = '44444444-4444-4444-4444-4444444444c3';
const PASSWORD = 'RlsTestPassword123!';
const ADOPTER_EMAIL = 'rls-337-adopter@example.com';
const STRANGER_EMAIL = 'rls-337-stranger@example.com';
const STAFF_EMAIL = 'rls-337-staff@example.com';
const MANAGER_EMAIL = 'rls-337-manager@example.com';

const LOCKED_CORE = [
  'con.full_name',
  'con.email',
  'con.phone',
  'con.address',
  'app.pet_interest',
  'app.why_this_pet',
  'hh.adults_count',
  'hh.children_count',
  'hou.home_type',
  'hou.own_rent',
  'hou.landlord_allows',
  'hou.landlord_contact',
  'yrd.has_yard',
  'yrd.fenced',
  'pet.current',
  'vet.contact',
  'trn.experience_level',
];
const ANY_SPECIES_EXTRA = 'lif.hours_alone';
const DOG_ONLY_EXTRA = 'hou.insurance_breed';

const SNAPSHOT = {
  full_name: 'RLS 337 Adopter',
  housing_type: 'rent_house',
  has_yard: true,
  household_adults: 2,
  household_children: 0,
};

type SnapshotEntry = { question_id: string; wording: string; value: unknown };

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: Question bank & saved answers (#337) [${RLS_SKIP_REASON}]`,
  () => {
    let adopter: TestUser;
    let stranger: TestUser;
    let staff: TestUser;
    let manager: TestUser;
    const applicationIds: string[] = [];

    async function snapshotOf(applicationId: string) {
      const { data } = await createServiceClient()
        .from('applications')
        .select('answers_snapshot')
        .eq('id', applicationId)
        .single();
      return (data!.answers_snapshot ?? []) as SnapshotEntry[];
    }

    async function apply(
      petId: string,
      forged?: { question_id: string; wording: string; value: string }[]
    ) {
      const client = await createAuthenticatedClient(ADOPTER_EMAIL, PASSWORD);
      const { data, error } = await client
        .from('applications')
        .insert({
          adopter_id: adopter.id,
          pet_id: petId,
          shelter_id: SHELTER_ID,
          profile_snapshot: SNAPSHOT,
          why_this_pet: 'We love this one',
          ...(forged ? { answers_snapshot: forged } : {}),
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      applicationIds.push(data!.id);
      return data!.id as string;
    }

    beforeAll(async () => {
      adopter = await createTestUser(ADOPTER_EMAIL, PASSWORD);
      stranger = await createTestUser(STRANGER_EMAIL, PASSWORD);
      staff = await createTestUser(STAFF_EMAIL, PASSWORD);
      manager = await createTestUser(MANAGER_EMAIL, PASSWORD);

      const service = createServiceClient();
      await service
        .from('shelters')
        .upsert({ id: SHELTER_ID, name: 'RLS 337 Rescue' });
      await service.from('shelter_members').insert([
        {
          shelter_id: SHELTER_ID,
          user_id: staff.id,
          role: 'staff',
        },
        {
          shelter_id: SHELTER_ID,
          user_id: manager.id,
          role: 'manager',
        },
      ]);
      await service.from('pets').upsert([
        {
          id: DOG_1,
          shelter_id: SHELTER_ID,
          name: 'Dog One',
          species: 'dog',
          status: 'available',
        },
        {
          id: DOG_2,
          shelter_id: SHELTER_ID,
          name: 'Dog Two',
          species: 'dog',
          status: 'available',
        },
        {
          id: CAT,
          shelter_id: SHELTER_ID,
          name: 'Cat',
          species: 'cat',
          status: 'available',
        },
      ]);
    }, 60000);

    afterAll(async () => {
      const service = createServiceClient();
      if (applicationIds.length) {
        await service.from('applications').delete().in('id', applicationIds);
      }
      await service
        .from('shelter_application_questions')
        .delete()
        .eq('shelter_id', SHELTER_ID);
      await service
        .from('shelter_application_flags')
        .delete()
        .eq('shelter_id', SHELTER_ID);
      await service.from('pets').delete().in('id', [DOG_1, DOG_2, CAT]);
      await service
        .from('shelter_members')
        .delete()
        .eq('shelter_id', SHELTER_ID);
      await service.from('shelters').delete().eq('id', SHELTER_ID);
      await service.from('adopter_profiles').delete().eq('id', adopter.id);
      await deleteTestUser(adopter.id);
      await deleteTestUser(stranger.id);
      await deleteTestUser(staff.id);
      await deleteTestUser(manager.id);
    }, 60000);

    it('the bank is readable and holds exactly the locked core', async () => {
      const client = await createAuthenticatedClient(STRANGER_EMAIL, PASSWORD);
      const { data, error } = await client
        .from('application_questions')
        .select('id')
        .eq('is_locked', true)
        .order('sort_order');

      expect(error).toBeNull();
      expect(data!.map((q) => q.id).sort()).toEqual([...LOCKED_CORE].sort());
    });

    it('a client cannot edit the bank', async () => {
      const client = await createAuthenticatedClient(STRANGER_EMAIL, PASSWORD);
      const { data } = await client
        .from('application_questions')
        .update({ wording: 'Hijacked wording' })
        .eq('id', 'con.email')
        .select('id');
      expect(data ?? []).toHaveLength(0);

      const { error } = await client.from('application_questions').insert({
        id: 'con.injected',
        category: 'contact',
        sort_order: 32000,
        wording: 'Injected question',
        answer_type: 'text',
      });
      expect(error).not.toBeNull();
    });

    it('saving the profile fills saved answers, and blanking a field clears it', async () => {
      const client = await createAuthenticatedClient(ADOPTER_EMAIL, PASSWORD);
      const { error } = await client.from('adopter_profiles').upsert({
        id: adopter.id,
        ...SNAPSHOT,
        landlord_approval: true,
        vet_name: 'Dr Vet',
        vet_phone: '555-0123',
      });
      expect(error).toBeNull();

      const { data: before } = await client
        .from('adopter_answers')
        .select('question_id, value');
      const answers = Object.fromEntries(
        (before ?? []).map((a) => [a.question_id, a.value])
      );
      expect(answers['hou.home_type']).toBe('house');
      expect(answers['hou.own_rent']).toBe('rent');
      expect(answers['hou.landlord_allows']).toBe('yes');
      expect(answers['vet.contact']).toEqual({
        name: 'Dr Vet',
        phone: '555-0123',
      });

      await client
        .from('adopter_profiles')
        .update({ vet_name: null, vet_phone: null })
        .eq('id', adopter.id);
      const { data: after } = await client
        .from('adopter_answers')
        .select('question_id')
        .eq('question_id', 'vet.contact');
      expect(after).toHaveLength(0);
    });

    it('an adopter manages own answers; a stranger cannot read or write them', async () => {
      const client = await createAuthenticatedClient(ADOPTER_EMAIL, PASSWORD);
      const { error } = await client.from('adopter_answers').upsert([
        { adopter_id: adopter.id, question_id: ANY_SPECIES_EXTRA, value: 6 },
        { adopter_id: adopter.id, question_id: DOG_ONLY_EXTRA, value: 'no' },
      ]);
      expect(error).toBeNull();

      const strangerClient = await createAuthenticatedClient(
        STRANGER_EMAIL,
        PASSWORD
      );
      const { data: visible } = await strangerClient
        .from('adopter_answers')
        .select('*')
        .eq('adopter_id', adopter.id);
      expect(visible).toHaveLength(0);

      const { error: writeError } = await strangerClient
        .from('adopter_answers')
        .insert({
          adopter_id: adopter.id,
          question_id: 'lif.where_when_away',
          value: 'crate',
        });
      expect(writeError).not.toBeNull();
    });

    it('shelter staff cannot read saved answers directly', async () => {
      const client = await createAuthenticatedClient(STAFF_EMAIL, PASSWORD);
      const { data } = await client
        .from('adopter_answers')
        .select('*')
        .eq('adopter_id', adopter.id);
      expect(data).toHaveLength(0);
    });

    it('a client cannot set which questions a rescue shows', async () => {
      const client = await createAuthenticatedClient(STAFF_EMAIL, PASSWORD);
      const { error } = await client
        .from('shelter_application_questions')
        .insert({ shelter_id: SHELTER_ID, question_id: ANY_SPECIES_EXTRA });
      expect(error).not.toBeNull();
    });

    it('staff cannot replace question choices through the manager RPC', async () => {
      const client = await createAuthenticatedClient(STAFF_EMAIL, PASSWORD);
      const { error } = await client.rpc('set_shelter_application_questions', {
        p_shelter_id: SHELTER_ID,
        p_question_ids: [ANY_SPECIES_EXTRA],
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('not_a_manager');
    });

    it('a manager cannot store an unknown question id', async () => {
      const client = await createAuthenticatedClient(MANAGER_EMAIL, PASSWORD);
      const { error } = await client.rpc('set_shelter_application_questions', {
        p_shelter_id: SHELTER_ID,
        p_question_ids: ['not.a.real.question'],
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain('invalid_question');
    });

    it('with no rescue choices the snapshot is exactly the locked core, ignoring a forged one', async () => {
      const id = await apply(DOG_1, [
        { question_id: 'forged', wording: 'x', value: 'x' },
      ]);
      const snapshot = await snapshotOf(id);

      expect(snapshot.map((e) => e.question_id).sort()).toEqual(
        [...LOCKED_CORE].sort()
      );
      const why = snapshot.find((e) => e.question_id === 'app.why_this_pet');
      expect(why!.value).toBe('We love this one');
      const pet = snapshot.find((e) => e.question_id === 'app.pet_interest');
      expect(pet!.value).toEqual({ pet_id: DOG_1, name: 'Dog One' });
    });

    it('showing questions adds them to new applications only, filtered by species', async () => {
      const firstId = applicationIds[0];
      const managerClient = await createAuthenticatedClient(
        MANAGER_EMAIL,
        PASSWORD
      );
      const { data, error } = await managerClient.rpc(
        'set_shelter_application_questions',
        {
          p_shelter_id: SHELTER_ID,
          p_question_ids: [ANY_SPECIES_EXTRA, DOG_ONLY_EXTRA, 'hou.home_type'],
        }
      );
      expect(error).toBeNull();
      expect(data).toBe(2);

      const dogSnapshot = await snapshotOf(await apply(DOG_2));
      const dogIds = dogSnapshot.map((e) => e.question_id);
      expect(dogIds).toContain(ANY_SPECIES_EXTRA);
      expect(dogIds).toContain(DOG_ONLY_EXTRA);
      expect(
        dogSnapshot.find((e) => e.question_id === ANY_SPECIES_EXTRA)!.value
      ).toBe(6);

      const catIds = (await snapshotOf(await apply(CAT))).map(
        (e) => e.question_id
      );
      expect(catIds).toContain(ANY_SPECIES_EXTRA);
      expect(catIds).not.toContain(DOG_ONLY_EXTRA);

      const firstIds = (await snapshotOf(firstId)).map((e) => e.question_id);
      expect(firstIds).not.toContain(ANY_SPECIES_EXTRA);
    });

    it('staff see the frozen snapshot on their application, not unshown answers', async () => {
      const client = await createAuthenticatedClient(STAFF_EMAIL, PASSWORD);
      const { data, error } = await client
        .from('applications')
        .select('answers_snapshot')
        .eq('id', applicationIds[0])
        .single();

      expect(error).toBeNull();
      const ids = (data!.answers_snapshot as SnapshotEntry[]).map(
        (e) => e.question_id
      );
      expect(ids).not.toContain(DOG_ONLY_EXTRA);
      expect(ids).toHaveLength(LOCKED_CORE.length);
    });

    it('staff cannot write red-flag rules; managers can', async () => {
      const staffClient = await createAuthenticatedClient(
        STAFF_EMAIL,
        PASSWORD
      );
      const { error: staffError } = await staffClient.rpc(
        'set_shelter_application_flag',
        {
          p_shelter_id: SHELTER_ID,
          p_question_id: 'hou.landlord_allows',
          p_answers: ['no'],
          p_comparator: 'in',
          p_threshold: null,
          p_label: "Landlord hasn't approved",
        }
      );
      expect(staffError).not.toBeNull();
      expect(staffError!.message).toContain('not_a_manager');

      const managerClient = await createAuthenticatedClient(
        MANAGER_EMAIL,
        PASSWORD
      );
      const { error } = await managerClient.rpc(
        'set_shelter_application_flag',
        {
          p_shelter_id: SHELTER_ID,
          p_question_id: 'hou.landlord_allows',
          p_answers: ['no', 'not_asked'],
          p_comparator: 'in',
          p_threshold: null,
          p_label: "Landlord hasn't approved",
        }
      );
      expect(error).toBeNull();

      const { data } = await managerClient
        .from('shelter_application_flags')
        .select('label')
        .eq('shelter_id', SHELTER_ID);
      expect(data).toEqual([{ label: "Landlord hasn't approved" }]);

      const adopterClient = await createAuthenticatedClient(
        ADOPTER_EMAIL,
        PASSWORD
      );
      const { data: hidden } = await adopterClient
        .from('shelter_application_flags')
        .select('label')
        .eq('shelter_id', SHELTER_ID);
      expect(hidden).toHaveLength(0);
    });

    it('tagged pets add matching question groups to new applications', async () => {
      const managerClient = await createAuthenticatedClient(
        MANAGER_EMAIL,
        PASSWORD
      );
      const { error } = await managerClient.rpc(
        'set_shelter_application_questions',
        {
          p_shelter_id: SHELTER_ID,
          p_question_ids: [
            ANY_SPECIES_EXTRA,
            DOG_ONLY_EXTRA,
            'pts.sight.leash_only',
          ],
        }
      );
      expect(error).toBeNull();

      const service = createServiceClient();
      await service
        .from('pets')
        .update({ application_tags: ['sighthound'] })
        .eq('id', DOG_2);
      // one_application_per_pet: the earlier test already applied for these
      // two pets as the same adopter, so clear those rows before applying again.
      await service
        .from('applications')
        .delete()
        .eq('adopter_id', adopter.id)
        .in('pet_id', [DOG_2, CAT]);

      const taggedIds = (await snapshotOf(await apply(DOG_2))).map(
        (e) => e.question_id
      );
      expect(taggedIds).toContain('pts.sight.leash_only');

      const catIds = (await snapshotOf(await apply(CAT))).map(
        (e) => e.question_id
      );
      expect(catIds).not.toContain('pts.sight.leash_only');
    });
  }
);
