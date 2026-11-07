/**
 * Paginated auth-user lookup for E2E tests.
 *
 * `auth.admin.listUsers()` defaults to page 1 with 50 users, newest first, so
 * a single unpaginated call silently hides the long-lived test accounts once
 * the project accumulates more than a page of users — which the isolated
 * messaging specs do every run by creating throwaway users. See issue #123.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  describeBackendError,
  retryWhileTransient,
} from '../../fixtures/transient-backend';

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

export async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.toLowerCase();

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Retry gateway hiccups so a brief outage is not read as "no such user".
    let users: User[] = [];
    const failure = await retryWhileTransient(async () => {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) return describeBackendError(error);
      users = data?.users ?? [];
      return undefined;
    });

    if (failure) {
      console.error(
        `findAuthUserByEmail: listUsers failed on page ${page}:`,
        failure
      );
      return null;
    }

    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;

    if (users.length < PAGE_SIZE) return null;
  }

  console.warn(
    `findAuthUserByEmail: stopped after ${MAX_PAGES} pages without finding ${email}`
  );
  return null;
}
