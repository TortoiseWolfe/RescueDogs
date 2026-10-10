/**
 * #433: addresses Edge Functions must never send real email to.
 * Imports the Deno shared module directly (it has no imports of its own).
 */

import { describe, it, expect } from 'vitest';
import { isTestRecipient } from '../../../../supabase/functions/_shared/test-recipients';

describe('isTestRecipient (#433)', () => {
  it.each([
    'manager@demo.test',
    'staff@secondchance.demo',
    'someone@example.com',
    'someone@mail.example.org',
    'someone@example.net',
    'user@site.example',
    'user@nowhere.invalid',
    'user@localhost',
    'user@host.localhost',
    'pilot+e2e@gmail.com',
    'pilot+playwright@gmail.com',
    'pilot+ci-17@gmail.com',
    '  MANAGER@DEMO.TEST  ',
  ])('treats %s as a test recipient', (email) => {
    expect(isTestRecipient(email)).toBe(true);
  });

  it.each(['', '   ', 'no-at-sign', '@gmail.com', 'user@', null, undefined])(
    'treats malformed address %j as undeliverable',
    (email) => {
      expect(isTestRecipient(email)).toBe(true);
    }
  );

  it.each([
    'rescue.manager@gmail.com',
    'annie@sunnysiderescue.org',
    'info@raisedpaws.com',
    'someone@testing.com',
    'someone@examples.com',
    'first.last+adoptions@gmail.com',
  ])('lets real address %s through', (email) => {
    expect(isTestRecipient(email)).toBe(false);
  });
});
