/**
 * RLS: customer feedback
 *
 * The acceptance test for the `feedback` section of the monolithic migration.
 * Reading a policy tells you what it says, not what Postgres does with it --
 * and every guarantee here is a refusal, which is the class of thing that
 * fails silently when it breaks. A missing SELECT policy does not error; it
 * returns an empty list, which looks exactly like an empty table.
 *
 * Skips (not hides) without a live Supabase, so a reviewer can see the
 * coverage is deferred rather than missing. Run via `pnpm test:rls`.
 *
 * @module tests/rls/feedback-rls.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createAuthenticatedClient,
  createAnonClient,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: customer feedback [${RLS_SKIP_REASON}]`,
  () => {
    let userA: TestUser;
    let userB: TestUser;
    let asA: SupabaseClient;

    beforeAll(async () => {
      userA = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      userB = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      asA = await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
    });

    afterAll(async () => {
      // The rows go with the users: `auth_user_id` is ON DELETE CASCADE.
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    });

    it('lets a signed-in person report a problem as themselves', async () => {
      const { error } = await asA.from('feedback').insert({
        auth_user_id: userA.id,
        body: 'The application form lost everything when I hit back.',
        context: { platform: 'web', app: 'test' },
      });
      expect(error).toBeNull();
    });

    it('refuses a report filed under somebody else', async () => {
      const { error } = await asA.from('feedback').insert({
        auth_user_id: userB.id,
        body: 'Written by A, blamed on B.',
      });
      expect(error).not.toBeNull();
    });

    /**
     * THE ONE THAT WOULD FAIL SILENTLY. There is no SELECT policy for any client
     * role, deliberately: a queue a signed-in visitor could read is a list of
     * other people's complaints. If somebody adds one "to build an admin view",
     * nothing errors and nothing looks different -- this is what notices.
     */
    it('shows a reporter nothing at all, including their own report', async () => {
      const { data, error } = await asA.from('feedback').select('*');
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('refuses a signed-out visitor entirely', async () => {
      const { error } = await createAnonClient().from('feedback').insert({
        auth_user_id: userA.id,
        body: 'From nobody.',
      });
      expect(error).not.toBeNull();
    });

    /**
     * SIX AN HOUR, IN THE DATABASE. The publishable key ships in every bundle,
     * so an attacker is not obliged to run our rate limiting. Six rather than
     * one, because a person hitting a real bug reports it, tries something, and
     * reports what happened next.
     */
    it('stops one identity filling the tracker: the seventh report in an hour is refused', async () => {
      const service = createServiceClient();
      // Five more on top of the one the first test wrote makes six.
      for (let i = 0; i < 5; i++) {
        const { error } = await asA.from('feedback').insert({
          auth_user_id: userA.id,
          body: `Report number ${i + 2}.`,
        });
        expect(error).toBeNull();
      }
      const { error } = await asA.from('feedback').insert({
        auth_user_id: userA.id,
        body: 'The seventh.',
      });
      expect(error?.message).toContain('feedback_too_often');

      await service.from('feedback').delete().eq('auth_user_id', userA.id);
    });

    /**
     * TWO GUARDS ON `screenshot_path`, AND EACH TEST BELOW EXERCISES THE ONE THE
     * OTHER CANNOT CATCH.
     *
     * The column is interpolated into a storage URL and fetched AS THE SERVICE
     * ROLE by `scripts/ci/feedback-to-issues.mjs` -- which reads every folder in
     * every bucket whatever RLS tells a client. Left as free text, a reporter
     * could name a path out of `pet-photos` or `avatars`.
     *
     * A BEFORE TRIGGER RUNS AHEAD OF A CHECK, so one test case would only ever
     * exercise whichever fires first, and a future "simplification" could delete
     * the other with the suite still green. These are deliberately two tests.
     */
    it('refuses a traversal by SHAPE, which only the CHECK constraint can catch', async () => {
      const { error } = await asA.from('feedback').insert({
        auth_user_id: userA.id,
        body: 'Malformed path.',
        // Well-prefixed by the caller's own id, so the trigger is satisfied --
        // only the regex refuses this.
        screenshot_path: `${userA.id}/../../pet-photos/x/y.jpg`,
      });
      expect(error?.code).toBe('23514');
    });

    it('refuses a well-formed path belonging to somebody else, which only the TRIGGER can catch', async () => {
      const { error } = await asA.from('feedback').insert({
        auth_user_id: userA.id,
        body: 'Somebody else’s folder.',
        // Perfectly shaped -- two uuids and a known extension -- so the CHECK
        // passes. The prefix is userB's, which is what the trigger compares.
        screenshot_path: `${userB.id}/${userA.id}.jpg`,
      });
      expect(error?.code).toBe('42501');
    });

    it('accepts a correctly-prefixed, correctly-shaped path', async () => {
      const service = createServiceClient();
      const { error } = await asA.from('feedback').insert({
        auth_user_id: userA.id,
        body: 'With a picture.',
        screenshot_path: `${userA.id}/${userB.id}.jpg`,
      });
      expect(error).toBeNull();
      await service.from('feedback').delete().eq('auth_user_id', userA.id);
    });
  }
);
