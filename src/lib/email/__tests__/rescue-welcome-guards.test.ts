/**
 * Unit coverage for #316 rescue welcome send guards. Imports the shipped
 * supabase/functions/_shared/rescue-welcome-guards.ts instead of a copy.
 */

import { describe, it, expect } from 'vitest';
import {
  isResendQuotaError,
  shouldSkipRescueWelcomeEmail,
} from '../../../../supabase/functions/_shared/rescue-welcome-guards';

describe('rescue welcome send guards (#316)', () => {
  it('skips app_metadata.e2e users', () => {
    expect(
      shouldSkipRescueWelcomeEmail({
        email: 'person10@example.com',
        app_metadata: { e2e: true },
      })
    ).toEqual({ skip: true, reason: 'e2e' });
  });

  it('skips known test email shapes', () => {
    expect(
      shouldSkipRescueWelcomeEmail({ email: 'foo@example.com' }).skip
    ).toBe(true);
    expect(
      shouldSkipRescueWelcomeEmail({ email: 'hello@secondchance.demo' }).skip
    ).toBe(true);
    expect(
      shouldSkipRescueWelcomeEmail({ email: 'person06@example.com' }).skip
    ).toBe(true);
    expect(
      shouldSkipRescueWelcomeEmail({ email: 'manager@demo.test' }).skip
    ).toBe(true);
  });

  it('allows normal rescue emails', () => {
    expect(
      shouldSkipRescueWelcomeEmail({ email: 'annie@sunnysiderescue.org' })
    ).toEqual({ skip: false });
  });

  it('detects Resend quota / rate limit bodies', () => {
    expect(isResendQuotaError(429, {})).toBe(true);
    expect(
      isResendQuotaError(403, { message: 'You have reached your daily quota' })
    ).toBe(true);
    expect(isResendQuotaError(500, { message: 'Internal' })).toBe(false);
  });
});
