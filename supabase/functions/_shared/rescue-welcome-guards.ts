/**
 * Guards for #316 rescue welcome email — keep E2E/CI from burning Resend quota.
 */

export type WelcomeUserLike = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

export function shouldSkipRescueWelcomeEmail(
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

/** Resend free-tier / rate-limit failures — do not unlock claim for retry storms. */
export function isResendQuotaError(status: number, body: unknown): boolean {
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
