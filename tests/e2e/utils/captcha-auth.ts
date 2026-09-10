/**
 * Node-side auth helpers for E2E under Supabase Bot Protection (Turnstile).
 *
 * After `security_captcha_enabled` is true, anon `signInWithPassword` without
 * a captcha_token is rejected. Helpers that only need a session fall back to
 * an admin magic-link (password is not re-checked on that path).
 *
 * UI wait helpers live in `captcha-ui.ts` so global-setup can import this
 * file without pulling `@playwright/test`.
 *
 * @module tests/e2e/utils/captcha-auth
 */

import { createClient, type Session, type User } from '@supabase/supabase-js';

export function isCaptchaProtectionError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('captcha');
}

let captchaEnforcedCache: boolean | null = null;

/**
 * Probe whether Supabase Auth rejects password grants without a captcha
 * token. Cached for the process — used to skip UI signup paths that CI
 * cannot complete against production Turnstile.
 */
export async function isSupabaseCaptchaEnforced(): Promise<boolean> {
  if (captchaEnforcedCache !== null) return captchaEnforcedCache;

  const url =
    process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    captchaEnforcedCache = false;
    return false;
  }

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await anon.auth.signInWithPassword({
    email: 'captcha-probe-not-a-real-user@raisedpaws.com',
    password: 'CaptchaProbeNotARealPassword1!',
  });

  captchaEnforcedCache = isCaptchaProtectionError(error?.message);
  return captchaEnforcedCache;
}

type ObtainResult =
  | { ok: true; session: Session; user: User; via: 'password' | 'admin-link' }
  | { ok: false; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Obtain a Supabase session for E2E injection / prerequisite checks.
 * Prefers password sign-in; if captcha blocks the anon API, uses admin
 * `generateLink` + `verifyOtp` (requires SUPABASE_SERVICE_ROLE_KEY).
 *
 * Magic-link verify is retried: parallel CI shards generating links for the
 * same PRIMARY email invalidate each other's tokens ("Email link is invalid
 * or has expired").
 */
export async function obtainAuthSession(
  email: string,
  password: string
): Promise<ObtainResult> {
  const url =
    process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    return { ok: false, error: 'Supabase URL or anon key not configured' };
  }

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  if (!error && data.session && data.user) {
    return {
      ok: true,
      session: data.session,
      user: data.user,
      via: 'password',
    };
  }

  if (!isCaptchaProtectionError(error?.message)) {
    return { ok: false, error: error?.message || 'sign-in failed' };
  }

  if (!serviceKey) {
    return {
      ok: false,
      error:
        'captcha blocked password sign-in and SUPABASE_SERVICE_ROLE_KEY is unset',
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let lastError = 'unknown';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      // Jitter so parallel shards don't stampede the same email.
      await sleep(150 * attempt + Math.floor(Math.random() * 200));
    }

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      lastError = linkError?.message || 'no hashed_token';
      continue;
    }

    const { data: otpData, error: otpError } = await anon.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'email',
    });

    if (!otpError && otpData.session && otpData.user) {
      return {
        ok: true,
        session: otpData.session,
        user: otpData.user,
        via: 'admin-link',
      };
    }

    lastError = otpError?.message || 'no session';
    const retryable =
      /invalid|expired|otp/i.test(lastError) ||
      lastError.toLowerCase().includes('link');
    if (!retryable) break;
  }

  return {
    ok: false,
    error: `captcha blocked password sign-in; verifyOtp failed: ${lastError}`,
  };
}
