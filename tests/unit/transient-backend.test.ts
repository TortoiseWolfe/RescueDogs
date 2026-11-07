import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  describeBackendError,
  isTransientBackendError,
  retryWhileTransient,
} from '../fixtures/transient-backend';

const signInWithPassword = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

// Keep the real classifier but make the waits instant.
vi.mock('../fixtures/transient-backend', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../fixtures/transient-backend')>();
  return { ...actual, transientBackoffMs: () => 0 };
});

describe('isTransientBackendError', () => {
  it.each([
    [
      'an HTML error page parsed as JSON',
      `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
    ],
    ['an empty object message', '{}'],
    ['an empty message', ''],
    ['a dropped connection', 'TypeError: fetch failed'],
    ['a gateway status', 'Bad Gateway 502'],
    [
      'an error with no message',
      'empty error message (AuthUnknownError, status none)',
    ],
  ])('treats %s as transient', (_label, message) => {
    expect(isTransientBackendError(message)).toBe(true);
  });

  it.each([
    'Invalid API key',
    'Invalid login credentials',
    'User not found',
    'captcha verification process failed',
  ])('treats "%s" as a real failure', (message) => {
    expect(isTransientBackendError(message)).toBe(false);
  });
});

describe('describeBackendError', () => {
  it('keeps a real message', () => {
    expect(describeBackendError({ message: 'Invalid API key' })).toBe(
      'Invalid API key'
    );
  });

  it('names the error when the message is empty or "{}"', () => {
    const described = describeBackendError({
      message: '{}',
      name: 'AuthUnknownError',
      status: 502,
    });
    expect(described).toContain('AuthUnknownError');
    expect(described).toContain('502');
    expect(isTransientBackendError(described)).toBe(true);
  });
});

describe('retryWhileTransient', () => {
  const instant = { backoffMs: () => 0 };

  it('returns undefined once an attempt succeeds after transient failures', async () => {
    const operation = vi
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValueOnce('{}')
      .mockResolvedValueOnce(`Unexpected token '<'`)
      .mockResolvedValueOnce(undefined);

    await expect(retryWhileTransient(operation, instant)).resolves.toBe(
      undefined
    );
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('fails at once on an error that is not transient', async () => {
    const operation = vi
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValue('Invalid API key');

    await expect(retryWhileTransient(operation, instant)).resolves.toBe(
      'Invalid API key'
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt limit and returns the last message', async () => {
    const operation = vi
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValue('{}');

    await expect(
      retryWhileTransient(operation, { ...instant, attempts: 3 })
    ).resolves.toBe('{}');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('treats a thrown error like a returned one', async () => {
    const operation = vi
      .fn<() => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(undefined);

    await expect(retryWhileTransient(operation, instant)).resolves.toBe(
      undefined
    );
  });
});

describe('obtainAuthSession', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    delete process.env.SUPABASE_ADMIN_URL;
  });

  it('retries a password sign-in that hit a gateway error page', async () => {
    const session = { access_token: 'a' };
    const user = { id: 'u1' };
    signInWithPassword
      .mockResolvedValueOnce({
        data: {},
        error: { message: `Unexpected token '<', "<!DOCTYPE "...`, name: 'X' },
      })
      .mockResolvedValueOnce({ data: { session, user }, error: null });

    const { obtainAuthSession } = await import('../fixtures/captcha-auth');
    const result = await obtainAuthSession('a@example.com', 'pw');

    expect(result).toMatchObject({ ok: true, via: 'password' });
    expect(signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it('does not retry a wrong password', async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials', name: 'AuthApiError' },
    });

    const { obtainAuthSession } = await import('../fixtures/captcha-auth');
    const result = await obtainAuthSession('a@example.com', 'bad');

    expect(result).toEqual({ ok: false, error: 'Invalid login credentials' });
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });
});
