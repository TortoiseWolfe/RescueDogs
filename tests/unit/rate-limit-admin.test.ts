/**
 * Unit tests for the E2E rate-limit cleanup helper (#346).
 *
 * The Supabase project behind E2E also serves production, so cleanup must
 * delete only the rows the rate-limit specs generated. These tests pin the
 * identifier pattern and the delete filter it feeds.
 *
 * @module tests/unit/rate-limit-admin.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const filter = vi.fn();
const gte = vi.fn();
const del = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      delete: () => {
        del();
        return {
          filter: (...args: unknown[]) => {
            filter(...args);
            return Promise.resolve({ error: null });
          },
          gte: (...args: unknown[]) => {
            gte(...args);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
  }),
}));

import * as admin from '../e2e/utils/rate-limit-admin';

const pattern = new RegExp(admin.TEST_RATE_LIMIT_IDENTIFIER_PATTERN, 'i');

describe('TEST_RATE_LIMIT_IDENTIFIER_PATTERN', () => {
  it.each([
    'ratelimit-serial-1731000000000-ab12cd@example.com',
    'bf-main-1731000000000-x9@example.com',
    'bf-userA-1731000000000-abcdef@example.com',
    'bf-lockout-time-1731000000000-abcdef@example.com',
    'someone+ratelimit-serial-1731000000000-ab12cd@gmail.com',
    'someone+bf-types-1731000000000-ab12cd@gmail.com',
  ])('matches generated identifier %s', (identifier) => {
    expect(pattern.test(identifier)).toBe(true);
  });

  it.each([
    'adopter@example.com',
    'bf@example.com',
    'someone+newsletter@gmail.com',
    'bf-main-123-ab@example.com',
    'x-bf-main-1731000000000-ab12cd@example.com',
    '203.0.113.7',
    '2001:db8::1',
    '',
  ])('does not match ordinary identifier %s', (identifier) => {
    expect(pattern.test(identifier)).toBe(false);
  });
});

describe('clearTestRateLimits', () => {
  beforeEach(() => {
    filter.mockClear();
    gte.mockClear();
    del.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('deletes only rows whose identifier matches the generated pattern', async () => {
    const result = await admin.clearTestRateLimits();

    expect(result).toBe(true);
    expect(filter).toHaveBeenCalledWith(
      'identifier',
      'imatch',
      admin.TEST_RATE_LIMIT_IDENTIFIER_PATTERN
    );
    expect(gte).not.toHaveBeenCalled();
  });

  it('no longer exports a helper that clears every row', () => {
    expect('clearAllRateLimits' in admin).toBe(false);
  });

  it('skips cleanup when no admin credentials are set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await admin.clearTestRateLimits();

    expect(result).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });
});
