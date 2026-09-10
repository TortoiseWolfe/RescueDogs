/**
 * Guarded auth storage for the browser Supabase client.
 *
 * Two cooperating protections:
 *
 * 1. **removeItem gate** (`setAllowAuthTokenRemoval`) — Supabase auth-js
 *    clears the session on transient Realtime/RLS 401/406 responses. Without
 *    the gate that wipe fires SIGNED_OUT and boots the user. Removal is only
 *    allowed during an explicit sign-out.
 *
 * 2. **sign-out barrier** (shared via localStorage) — after an explicit
 *    sign-out, a sibling tab with an in-flight token refresh can call
 *    `setItem` and rewrite the cleared auth-token into shared storage
 *    (auth-js 2.72 has no cross-tab commit guard). The barrier is visible to
 *    every tab, so those rewrites are dropped until the next intentional
 *    sign-in. See issue #296 / FR-009.
 *
 * @module lib/supabase/auth-storage
 */

/** localStorage key — must be readable by every tab in the origin. */
export const AUTH_SIGNOUT_BARRIER_KEY = 'rd-auth-signout-barrier';

/**
 * How long the barrier stays active if nobody signs back in.
 * Safety valve only — normal path clears on sign-in.
 */
export const AUTH_SIGNOUT_BARRIER_TTL_MS = 24 * 60 * 60 * 1000;

let _allowAuthTokenRemoval = false;

export function setAllowAuthTokenRemoval(value: boolean): void {
  _allowAuthTokenRemoval = value;
}

export function getAllowAuthTokenRemoval(): boolean {
  return _allowAuthTokenRemoval;
}

function isAuthTokenKey(key: string): boolean {
  return key.includes('auth-token');
}

/**
 * Mark shared storage so sibling tabs cannot re-persist an auth session
 * after this tab signed out. Call BEFORE clearing the session.
 */
export function markAuthSignOutBarrier(
  storage: Pick<Storage, 'setItem'> = window.localStorage,
  now: number = Date.now()
): void {
  storage.setItem(AUTH_SIGNOUT_BARRIER_KEY, String(now));
}

/**
 * Clear the barrier so a new sign-in can persist its session.
 * Call at the start of every intentional auth entry path.
 */
export function clearAuthSignOutBarrier(
  storage: Pick<Storage, 'removeItem'> = window.localStorage
): void {
  storage.removeItem(AUTH_SIGNOUT_BARRIER_KEY);
}

export function isAuthSignOutBarrierActive(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
  now: number = Date.now()
): boolean {
  const raw = storage.getItem(AUTH_SIGNOUT_BARRIER_KEY);
  if (!raw) return false;
  const stamped = Number(raw);
  if (!Number.isFinite(stamped)) return false;
  return now - stamped < AUTH_SIGNOUT_BARRIER_TTL_MS;
}

/**
 * Force-remove any surviving Supabase auth-token keys. Used after
 * `signOut` so a blocked or raced removeItem cannot leave a session
 * for the next document load (#296).
 */
export function purgeAuthTokenKeys(
  storage: Pick<Storage, 'removeItem'> & {
    length: number;
    key(index: number): string | null;
  } = window.localStorage
): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && isAuthTokenKey(key)) keys.push(key);
  }
  for (const key of keys) {
    storage.removeItem(key);
  }
}

export type GuardedAuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/**
 * Build the Supabase `auth.storage` adapter backed by `window.localStorage`
 * (or an injectable Storage for tests).
 */
export function createGuardedAuthStorage(
  storage: Storage = window.localStorage,
  now: () => number = Date.now
): GuardedAuthStorage {
  return {
    getItem: (key: string) => storage.getItem(key),
    setItem: (key: string, value: string) => {
      // Sibling-tab refresh must not resurrect a session after sign-out.
      if (isAuthTokenKey(key) && isAuthSignOutBarrierActive(storage, now())) {
        return;
      }
      storage.setItem(key, value);
    },
    removeItem: (key: string) => {
      if (isAuthTokenKey(key) && !_allowAuthTokenRemoval) {
        return;
      }
      storage.removeItem(key);
    },
  };
}
