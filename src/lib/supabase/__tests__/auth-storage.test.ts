/**
 * Unit tests for guarded auth storage (#296 / FR-009).
 *
 * Proves the cross-tab resurrection race: after an explicit sign-out
 * barrier is raised, a sibling tab's setItem of an auth-token is dropped.
 * Without the barrier, that setItem would leave a valid session in shared
 * localStorage for the next document load.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AUTH_SIGNOUT_BARRIER_KEY,
  AUTH_SIGNOUT_BARRIER_TTL_MS,
  clearAuthSignOutBarrier,
  createGuardedAuthStorage,
  getAllowAuthTokenRemoval,
  isAuthSignOutBarrierActive,
  markAuthSignOutBarrier,
  purgeAuthTokenKeys,
  setAllowAuthTokenRemoval,
} from '@/lib/supabase/auth-storage';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  };
  return storage as Storage;
}

describe('auth-storage guard (#296)', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
    setAllowAuthTokenRemoval(false);
  });

  afterEach(() => {
    setAllowAuthTokenRemoval(false);
  });

  it('blocks auth-token removeItem unless removal is allowed', () => {
    const adapter = createGuardedAuthStorage(storage);
    storage.setItem('sb-test-auth-token', '{"access_token":"alive"}');

    adapter.removeItem('sb-test-auth-token');
    expect(storage.getItem('sb-test-auth-token')).toBe(
      '{"access_token":"alive"}'
    );

    setAllowAuthTokenRemoval(true);
    adapter.removeItem('sb-test-auth-token');
    expect(storage.getItem('sb-test-auth-token')).toBeNull();
    expect(getAllowAuthTokenRemoval()).toBe(true);
  });

  it('blocks auth-token setItem while the sign-out barrier is active', () => {
    const adapter = createGuardedAuthStorage(storage, () => 1_000_500);
    markAuthSignOutBarrier(storage, 1_000_000);

    adapter.setItem(
      'sb-proj-auth-token',
      JSON.stringify({
        access_token: 'resurrected',
        expires_at: 9_999_999_999,
      })
    );

    expect(storage.getItem('sb-proj-auth-token')).toBeNull();
    expect(isAuthSignOutBarrierActive(storage, 1_000_500)).toBe(true);
  });

  it('allows auth-token setItem after the barrier is cleared (sign-in path)', () => {
    const adapter = createGuardedAuthStorage(storage);
    markAuthSignOutBarrier(storage, 1_000_000);
    clearAuthSignOutBarrier(storage);

    const payload = JSON.stringify({ access_token: 'fresh' });
    adapter.setItem('sb-proj-auth-token', payload);

    expect(storage.getItem('sb-proj-auth-token')).toBe(payload);
  });

  it('expires the barrier after TTL so a stale stamp cannot brick auth forever', () => {
    markAuthSignOutBarrier(storage, 1_000);
    expect(
      isAuthSignOutBarrierActive(storage, 1_000 + AUTH_SIGNOUT_BARRIER_TTL_MS)
    ).toBe(false);
    expect(storage.getItem(AUTH_SIGNOUT_BARRIER_KEY)).toBe('1000');
  });

  it('purgeAuthTokenKeys removes surviving auth-token entries', () => {
    storage.setItem('sb-a-auth-token', 'one');
    storage.setItem('unrelated', 'keep');
    storage.setItem('sb-b-auth-token', 'two');

    setAllowAuthTokenRemoval(true);
    purgeAuthTokenKeys(storage);

    expect(storage.getItem('sb-a-auth-token')).toBeNull();
    expect(storage.getItem('sb-b-auth-token')).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('reproduces the #296 race: sibling refresh loses after barrier+purge', () => {
    // Tab 1 had a session; Tab 2 still holds a refresh about to setItem.
    storage.setItem(
      'sb-proj-auth-token',
      JSON.stringify({ access_token: 'old', expires_at: 9_999_999_999 })
    );
    const adapter = createGuardedAuthStorage(storage);

    // Tab 1 sign-out sequence (order matters — barrier first).
    markAuthSignOutBarrier(storage, Date.now());
    setAllowAuthTokenRemoval(true);
    adapter.removeItem('sb-proj-auth-token');
    purgeAuthTokenKeys(storage);
    setAllowAuthTokenRemoval(false);

    // Tab 2's late refresh tries to resurrect the session.
    adapter.setItem(
      'sb-proj-auth-token',
      JSON.stringify({
        access_token: 'from-sibling-refresh',
        expires_at: 9_999_999_999,
      })
    );

    expect(storage.getItem('sb-proj-auth-token')).toBeNull();
  });
});
