/**
 * Unit coverage for #316 rescue welcome send guards
 * (mirrors supabase/functions/_shared/rescue-welcome-guards.ts).
 */

import { describe, it, expect } from 'vitest';

type WelcomeUserLike = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function shouldSkipRescueWelcomeEmail(
  user: WelcomeUserLike
): { skip: true; reason: string } | { skip: false } {
  if (user.app_metadata?.e2e === true || user.user_metadata?.e2e === true) {
    return { skip: true, reason: 'e2e' };
  }

  const email = (user.email ?? '').trim().toLowerCase();
  if (!email) {
    return { skip: true, reason: 'no_email' };
  }

  if (
    email.endsWith('@example.com') ||
    email.endsWith('.demo') ||
    email.includes('+e2e') ||
    email.includes('+playwright') ||
    email.includes('+ci-')
  ) {
    return { skip: true, reason: 'test_email' };
  }

  return { skip: false };
}

function isResendQuotaError(status: number, body: unknown): boolean {
  if (status === 429) return true;
  const text = JSON.stringify(body ?? {}).toLowerCase();
  return (
    text.includes('quota') ||
    text.includes('rate_limit') ||
    text.includes('rate limit') ||
    text.includes('too many') ||
    text.includes('daily')
  );
}

describe('rescue welcome send guards (#316)', () => {
  it('skips app_metadata.e2e users', () => {
    expect(
      shouldSkipRescueWelcomeEmail({
        email: 'real@gmail.com',
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
      shouldSkipRescueWelcomeEmail({ email: 'me+e2e@gmail.com' }).skip
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
