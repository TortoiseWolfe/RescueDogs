/**
 * performSignIn under captcha (#457)
 *
 * When Supabase captcha is enforced the helper injects a session instead of
 * filling SignInForm, so it cannot tick Remember Me. It must refuse that
 * request instead of reporting success on a session it wrote itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isEnforced, obtainSession } = vi.hoisted(() => ({
  isEnforced: vi.fn(),
  obtainSession: vi.fn(),
}));

vi.mock('../../fixtures/captcha-auth', () => ({
  isSupabaseCaptchaEnforced: isEnforced,
  obtainAuthSession: obtainSession,
}));

import { performSignIn } from '../../e2e/utils/test-user-factory';

function fakePage() {
  return {
    url: () => 'http://localhost:3000/sign-in',
    goto: vi.fn(),
    evaluate: vi.fn(),
    addInitScript: vi.fn(),
  } as unknown as Parameters<typeof performSignIn>[0];
}

describe('performSignIn under captcha (#457)', () => {
  beforeEach(() => {
    isEnforced.mockReset();
    obtainSession.mockReset();
    isEnforced.mockResolvedValue(true);
    obtainSession.mockResolvedValue({ ok: false, error: 'no session' });
  });

  it('refuses rememberMe: true and names the cause', async () => {
    const result = await performSignIn(fakePage(), 'a@b.c', 'pw', {
      rememberMe: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rememberMe/);
    expect(result.error).toMatch(/captcha/i);
  });

  it('does not mint or inject a session when it refuses', async () => {
    await performSignIn(fakePage(), 'a@b.c', 'pw', { rememberMe: true });

    expect(obtainSession).not.toHaveBeenCalled();
  });

  it('still injects a session when rememberMe is not asked for', async () => {
    await performSignIn(fakePage(), 'a@b.c', 'pw');

    expect(obtainSession).toHaveBeenCalledTimes(1);
  });

  it('still injects a session when rememberMe is explicitly false', async () => {
    await performSignIn(fakePage(), 'a@b.c', 'pw', { rememberMe: false });

    expect(obtainSession).toHaveBeenCalledTimes(1);
  });
});
