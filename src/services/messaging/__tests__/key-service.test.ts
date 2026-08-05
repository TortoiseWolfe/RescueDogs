/**
 * Unit Test: KeyManagementService
 *
 * Tests KeyManagementService methods with fully mocked dependencies:
 * Supabase client, messaging client, encryption service, key-derivation
 * service, IndexedDB (Dexie) table, and crypto.subtle. No network, no real
 * crypto, no real IndexedDB — fast, deterministic unit tests.
 *
 * The service exports a class (KeyManagementService) plus a module-level
 * singleton (keyManagementService). The singleton carries in-memory state
 * (derivedKeys + publicKeyCache); we clear it in beforeEach via clearKeys()
 * / clearPublicKeyCache() so tests don't pollute each other.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Valid test UUIDs
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// Supabase client mock (auth lives here)
// ---------------------------------------------------------------------------
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
} as unknown as SupabaseClient;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// Messaging client mock (all user_encryption_keys table access)
// ---------------------------------------------------------------------------
const mockMessagingFrom = vi.fn();

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => ({
    from: mockMessagingFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Encryption service mock (IndexedDB private-key persistence)
// ---------------------------------------------------------------------------
const mockStorePrivateKey = vi.fn().mockResolvedValue(undefined);
const mockGetPrivateKey = vi.fn().mockResolvedValue(null);
const mockGetPrivateKeyFingerprint = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    storePrivateKey: (userId: string, key: CryptoKey, fingerprint?: string) =>
      mockStorePrivateKey(userId, key, fingerprint),
    getPrivateKey: (userId: string) => mockGetPrivateKey(userId),
    getPrivateKeyFingerprint: (userId: string) =>
      mockGetPrivateKeyFingerprint(userId),
  },
}));

// ---------------------------------------------------------------------------
// Key-derivation service mock (Argon2id + ECDH). The service instantiates
// `new KeyDerivationService()`, so mock the class to return controllable
// instance methods.
// ---------------------------------------------------------------------------
const mockGenerateSalt = vi.fn();
const mockDeriveKeyPair = vi.fn();
const mockVerifyPublicKey = vi.fn();

vi.mock('@/lib/messaging/key-derivation', () => ({
  KeyDerivationService: class {
    generateSalt = mockGenerateSalt;
    deriveKeyPair = mockDeriveKeyPair;
    verifyPublicKey = mockVerifyPublicKey;
  },
}));

// ---------------------------------------------------------------------------
// Dexie database mock (clearKeys fire-and-forget IndexedDB wipe)
// ---------------------------------------------------------------------------
const mockPrivateKeysClear = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/messaging/database', () => ({
  db: {
    messaging_private_keys: {
      clear: mockPrivateKeysClear,
    },
  },
}));

// ---------------------------------------------------------------------------
// crypto.subtle.importKey stub (restoreKeysFromCache imports the public JWK)
// ---------------------------------------------------------------------------
const mockImportKey = vi.fn().mockResolvedValue({} as CryptoKey);
// generateKey/exportKey are used by initializeDeviceKeys (the #60 passwordless
// bootstrap), which ensureKeysForSession falls through to on an IndexedDB miss.
const mockGenerateKey = vi.fn().mockResolvedValue({
  privateKey: {} as CryptoKey,
  publicKey: {} as CryptoKey,
});
const mockExportKey = vi
  .fn()
  .mockResolvedValue({ kty: 'EC', crv: 'P-256', x: 'device-x', y: 'device-y' });
vi.stubGlobal('crypto', {
  subtle: {
    importKey: mockImportKey,
    generateKey: mockGenerateKey,
    exportKey: mockExportKey,
  },
});

// Mock query builder (matches connection-service.test.ts pattern)
const createMockQueryBuilder = (data: any = null, error: any = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  then: vi.fn((resolve) => resolve({ data, error })),
});

// Reusable fake derived key pair + JWKs
const PUBLIC_JWK: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'derived-x',
  y: 'derived-y',
};
const fakeKeyPair = {
  privateKey: {} as CryptoKey,
  publicKey: {} as CryptoKey,
  publicKeyJwk: PUBLIC_JWK,
  salt: 'base64salt',
};

// navigator.onLine helper
const setOnline = (online: boolean) => {
  Object.defineProperty(global, 'navigator', {
    value: { onLine: online },
    configurable: true,
  });
};

// Import after mocks are set up
const { keyManagementService, KeyManagementService } = await import(
  '../key-service'
);

describe('KeyManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear singleton in-memory state between tests.
    keyManagementService.clearKeys();
    keyManagementService.clearPublicKeyCache();

    // Default: authenticated user via BOTH getSession + getUser.
    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: CURRENT_USER_ID } } },
      error: null,
    } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    } as any);

    // Default key-derivation behavior: succeed + verify true.
    mockGenerateSalt.mockReturnValue(new Uint8Array([1, 2, 3, 4]));
    mockDeriveKeyPair.mockResolvedValue(fakeKeyPair);
    mockVerifyPublicKey.mockReturnValue(true);

    // Default: persistence + restore stubs
    mockStorePrivateKey.mockResolvedValue(undefined);
    mockGetPrivateKey.mockResolvedValue(null);
    mockGetPrivateKeyFingerprint.mockResolvedValue(null);
    mockImportKey.mockResolvedValue({} as CryptoKey);

    // Default: online (so getUserPublicKey hits DB unless overridden).
    setOnline(true);
  });

  describe('singleton export', () => {
    it('exposes a singleton instance of KeyManagementService', () => {
      expect(keyManagementService).toBeInstanceOf(KeyManagementService);
    });
  });

  describe('ensureKeysForSession concurrency (#126)', () => {
    /**
     * Regression guard for #126. EncryptionKeyGate's effect re-fires whenever the
     * `user` OBJECT identity changes (AuthContext calls setUser at four sites during
     * hydration / onAuthStateChange / refresh). With no single-flight guard, each
     * re-fire ran a FULL bootstrap: revoke every live row, then insert a brand-new
     * RANDOM device key.
     *
     * Observed in CI (run 30981937723): 62 of 74 opens ended with THREE live key
     * rows, inserted within ~17ms of each other. A peer that fetched the recipient's
     * public key mid-race encrypted to a key that was immediately superseded, and
     * the recipient — holding only the last one — could never decrypt it. That is
     * the permanent "AES-GCM decryption failed" behind the chromium-msg-iso flake,
     * and it hits real users whose token refreshes while they open messaging.
     */
    const primeBootstrapMocks = () => {
      // No cached private key => restoreKeysFromCache() misses and the bootstrap
      // path runs (this is always true for a fresh browser/device).
      mockGetPrivateKey.mockResolvedValue(null);
      // hasKeysForUser() finds an existing row => the destructive revoke+insert path.
      const builder = createMockQueryBuilder({ id: 'existing-key-row' }, null);
      mockMessagingFrom.mockReturnValue(builder);
      return builder;
    };

    it('performs exactly ONE bootstrap for concurrent calls', async () => {
      const builder = primeBootstrapMocks();

      const results = await Promise.all([
        keyManagementService.ensureKeysForSession(CURRENT_USER_ID),
        keyManagementService.ensureKeysForSession(CURRENT_USER_ID),
        keyManagementService.ensureKeysForSession(CURRENT_USER_ID),
      ]);

      // One inserted key row, not three.
      expect(builder.insert).toHaveBeenCalledTimes(1);
      expect(mockGenerateKey).toHaveBeenCalledTimes(1);
      // Every caller observes the SAME key pair.
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
    });

    it('still bootstraps again on a later call once keys are cleared', async () => {
      const builder = primeBootstrapMocks();

      await keyManagementService.ensureKeysForSession(CURRENT_USER_ID);
      expect(builder.insert).toHaveBeenCalledTimes(1);

      // A fresh session (e.g. sign out / sign in) must not be blocked by a stale
      // in-flight entry — the guard has to release once settled (#60 UX).
      keyManagementService.clearKeys();
      mockGetPrivateKey.mockResolvedValue(null);
      await keyManagementService.ensureKeysForSession(CURRENT_USER_ID);
      expect(builder.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('atomic key rotation (#147)', () => {
    /**
     * Rotation used to REVOKE every live row and only then insert the replacement.
     * That leaves a window where the user has ZERO usable keys: a peer calling
     * getUserPublicKey in that gap gets nothing (message send fails outright), and a
     * peer that read just before the revoke encrypts to a key now marked dead.
     *
     * Insert-first closes the window. Selection is newest-first, so during the brief
     * overlap a peer reads the NEW key — the one this device actually holds — and the
     * old rows are revoked immediately after. There is never a moment with no live key.
     */
    const orderTrackingBuilder = (order: string[]) => {
      const builder: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn(() => {
          order.push('insert');
          return builder;
        }),
        update: vi.fn(() => {
          order.push('revoke');
          return builder;
        }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-device-row', encryption_salt: 'salt' },
          error: null,
        }),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { id: 'existing-row' }, error: null }),
        then: vi.fn((resolve: (v: unknown) => unknown) =>
          resolve({ data: { id: 'new-device-row' }, error: null })
        ),
      };
      return builder;
    };

    it('inserts the new device key BEFORE revoking the old ones', async () => {
      mockGetPrivateKey.mockResolvedValue(null); // IndexedDB miss → bootstrap path
      const order: string[] = [];
      mockMessagingFrom.mockReturnValue(orderTrackingBuilder(order));

      await keyManagementService.ensureKeysForSession(CURRENT_USER_ID);

      expect(order[0]).toBe('insert');
      expect(order).toContain('revoke');
    });

    it('excludes the newly created key from the revoke', async () => {
      mockGetPrivateKey.mockResolvedValue(null);
      const order: string[] = [];
      const builder = orderTrackingBuilder(order);
      mockMessagingFrom.mockReturnValue(builder);

      await keyManagementService.ensureKeysForSession(CURRENT_USER_ID);

      // The revoke must scope AROUND the new row, or it kills the key it just made.
      expect(builder.neq).toHaveBeenCalledWith('id', 'new-device-row');
    });
  });

  describe('restoreKeysFromCache mismatch self-heal (#126)', () => {
    /**
     * If a duplicate-key race left the cached private key belonging to a
     * DIFFERENT keypair than the newest stored public key, the old code happily
     * assembled the mixed pair and returned true — so ensureKeysForSession
     * short-circuited and the account stayed permanently broken in BOTH
     * directions (peers encrypt to the newest row this user cannot decrypt;
     * this user encrypts with a private key peers do not have the public half
     * of). Returning false instead lets the bootstrap mint a consistent key.
     */
    it('refuses a mixed pair so the caller can re-bootstrap', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      mockGetPrivateKeyFingerprint.mockResolvedValue('a-different-key');
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'salt', public_key: PUBLIC_JWK },
          null
        )
      );

      const restored =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(restored).toBe(false);
      expect(keyManagementService.getCurrentKeys()).toBeNull();
    });

    it('accepts the pair when the fingerprint matches', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      mockGetPrivateKeyFingerprint.mockResolvedValue(PUBLIC_JWK.x);
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'salt', public_key: PUBLIC_JWK },
          null
        )
      );

      const restored =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(restored).toBe(true);
    });

    it('accepts legacy records that predate the fingerprint field', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      mockGetPrivateKeyFingerprint.mockResolvedValue(null); // legacy row
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'salt', public_key: PUBLIC_JWK },
          null
        )
      );

      const restored =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(restored).toBe(true);
    });
  });

  describe('initializeKeys', () => {
    it('derives, uploads, and stores keys for a new user', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      const result = await keyManagementService.initializeKeys('password');

      expect(result).toEqual(fakeKeyPair);
      expect(mockDeriveKeyPair).toHaveBeenCalled();
      expect(mockStorePrivateKey).toHaveBeenCalledWith(
        CURRENT_USER_ID,
        fakeKeyPair.privateKey,
        // #126: the public-key fingerprint is persisted alongside the private
        // key so restoreKeysFromCache can detect a mismatched pair.
        PUBLIC_JWK.x
      );
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        keyManagementService.initializeKeys('password')
      ).rejects.toThrow('You must be signed in to initialize encryption keys');
    });

    it('throws ConnectionError when the upload fails', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'insert failed' })
      );

      await expect(
        keyManagementService.initializeKeys('password')
      ).rejects.toThrow('Failed to upload public key: insert failed');
    });
  });

  describe('deriveKeys', () => {
    it('derives keys and verifies the stored public key (happy path)', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'YWJjZA==', public_key: PUBLIC_JWK },
          null
        )
      );

      const result = await keyManagementService.deriveKeys('password');

      expect(result).toEqual(fakeKeyPair);
      expect(mockVerifyPublicKey).toHaveBeenCalled();
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });

    it('throws KeyMismatchError when password is wrong (verifyPublicKey false)', async () => {
      mockVerifyPublicKey.mockReturnValue(false);
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'YWJjZA==', public_key: PUBLIC_JWK },
          null
        )
      );

      await expect(keyManagementService.deriveKeys('wrong')).rejects.toThrow(
        "Incorrect password. The encryption key doesn't match. Please try again."
      );
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.deriveKeys('password')).rejects.toThrow(
        'You must be signed in to derive encryption keys'
      );
    });

    it('throws KeyDerivationError when no salt exists for the user', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      await expect(keyManagementService.deriveKeys('password')).rejects.toThrow(
        'No salt found. User may need migration or initialization.'
      );
    });
  });

  describe('getCurrentKeys', () => {
    it('returns null when no keys are in memory', () => {
      expect(keyManagementService.getCurrentKeys()).toBeNull();
    });

    it('returns the in-memory key pair after initializeKeys', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });
  });

  describe('restoreKeysFromCache', () => {
    it('returns true immediately when keys already in memory', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(true);
      // Should not have queried IndexedDB since memory was populated.
      expect(mockGetPrivateKey).not.toHaveBeenCalled();
    });

    it('returns false when no userId is provided', async () => {
      const result = await keyManagementService.restoreKeysFromCache();
      expect(result).toBe(false);
    });

    it('returns false when no private key exists in IndexedDB', async () => {
      mockGetPrivateKey.mockResolvedValue(null);

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(false);
    });

    it('rebuilds the key pair from IndexedDB + Supabase (happy path)', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'base64salt', public_key: PUBLIC_JWK },
          null
        )
      );

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(true);
      expect(mockImportKey).toHaveBeenCalled();
      expect(keyManagementService.getCurrentKeys()).toMatchObject({
        publicKeyJwk: PUBLIC_JWK,
        salt: 'base64salt',
      });
    });

    it('returns false when private key exists but Supabase has no public key/salt', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('clearKeys', () => {
    it('clears in-memory keys but retains IndexedDB (#60)', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');
      expect(keyManagementService.getCurrentKeys()).not.toBeNull();

      keyManagementService.clearKeys();

      expect(keyManagementService.getCurrentKeys()).toBeNull();
      expect(mockPrivateKeysClear).not.toHaveBeenCalled();
    });
  });

  describe('needsMigration', () => {
    it('returns false when user is not authenticated', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      expect(await keyManagementService.needsMigration()).toBe(false);
    });

    it('returns false when user has at least one key with a valid salt', async () => {
      // First query (valid keys with salt) returns a row.
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([{ id: 'k1' }], null)
      );

      expect(await keyManagementService.needsMigration()).toBe(false);
    });

    it('returns true when user has keys but none have a salt (legacy)', async () => {
      // First query: no keys with salt. Second query: has some keys.
      const noSaltKeys = createMockQueryBuilder([], null);
      const anyKeys = createMockQueryBuilder([{ id: 'legacy' }], null);
      let call = 0;
      mockMessagingFrom.mockImplementation(() => {
        call += 1;
        return call === 1 ? noSaltKeys : anyKeys;
      });

      expect(await keyManagementService.needsMigration()).toBe(true);
    });
  });

  describe('hasKeysForUser', () => {
    it('returns true when a non-revoked key row exists', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ id: 'k1' }, null)
      );

      expect(await keyManagementService.hasKeysForUser(OTHER_USER_ID)).toBe(
        true
      );
    });

    it('returns false when no key row exists', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      expect(await keyManagementService.hasKeysForUser(OTHER_USER_ID)).toBe(
        false
      );
    });

    it('throws ConnectionError on a non-PGRST116 database error', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: '500', message: 'boom' })
      );

      await expect(
        keyManagementService.hasKeysForUser(OTHER_USER_ID)
      ).rejects.toThrow('Failed to check encryption keys: boom');
    });
  });

  describe('hasKeys', () => {
    it('returns true when the authenticated user has a key row', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ id: 'k1' }, null)
      );

      expect(await keyManagementService.hasKeys()).toBe(true);
    });

    it('returns false when not authenticated', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);

      expect(await keyManagementService.hasKeys()).toBe(false);
    });

    it('throws ConnectionError on a real database error', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: '500', message: 'db down' })
      );

      await expect(keyManagementService.hasKeys()).rejects.toThrow(
        'Failed to check encryption keys: db down'
      );
    });
  });

  describe('hasValidKeys', () => {
    it('returns true when keys are in memory (no DB hit)', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');

      mockGetPrivateKey.mockClear();
      expect(await keyManagementService.hasValidKeys()).toBe(true);
      expect(mockGetPrivateKey).not.toHaveBeenCalled();
    });

    it('falls back to IndexedDB and returns true when a private key exists', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);

      expect(await keyManagementService.hasValidKeys()).toBe(true);
      expect(mockGetPrivateKey).toHaveBeenCalledWith(CURRENT_USER_ID);
    });

    it('throws AuthenticationError when not signed in and no memory keys', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.hasValidKeys()).rejects.toThrow(
        'You must be signed in to check encryption keys'
      );
    });
  });

  describe('rotateKeys', () => {
    it('revokes old keys, derives + uploads new ones (happy path)', async () => {
      // Both update (revoke) and insert (upload) resolve with no error.
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      const result = await keyManagementService.rotateKeys('password');

      expect(result).toBe(true);
      expect(mockDeriveKeyPair).toHaveBeenCalled();
      expect(mockStorePrivateKey).toHaveBeenCalledWith(
        CURRENT_USER_ID,
        fakeKeyPair.privateKey,
        // #126: the public-key fingerprint is persisted alongside the private
        // key so restoreKeysFromCache can detect a mismatched pair.
        PUBLIC_JWK.x
      );
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.rotateKeys('password')).rejects.toThrow(
        'You must be signed in to rotate encryption keys'
      );
    });

    it('throws ConnectionError when revoking old keys fails', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'revoke failed' })
      );

      await expect(keyManagementService.rotateKeys('password')).rejects.toThrow(
        'Failed to revoke old keys: revoke failed'
      );
    });
  });

  describe('revokeKeys', () => {
    it('marks all keys revoked when authenticated', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      await expect(keyManagementService.revokeKeys()).resolves.toBeUndefined();
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.revokeKeys()).rejects.toThrow(
        'You must be signed in to revoke encryption keys'
      );
    });

    it('throws ConnectionError when the revoke update fails', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'update failed' })
      );

      await expect(keyManagementService.revokeKeys()).rejects.toThrow(
        'Failed to revoke keys: update failed'
      );
    });
  });

  describe('getUserPublicKey', () => {
    it('fetches the public key from the database when online', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ public_key: PUBLIC_JWK }, null)
      );

      const result = await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      expect(result).toEqual(PUBLIC_JWK);
    });

    it('returns null when no key row exists (PGRST116)', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'no rows' })
      );

      expect(
        await keyManagementService.getUserPublicKey(OTHER_USER_ID)
      ).toBeNull();
    });

    it('throws ConnectionError on a real query error', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: '500', message: 'query boom' })
      );

      await expect(
        keyManagementService.getUserPublicKey(OTHER_USER_ID)
      ).rejects.toThrow('Failed to get user public key: query boom');
    });

    it('returns the cached key when offline (offline-cache branch)', async () => {
      // First, populate the cache via an online fetch.
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ public_key: PUBLIC_JWK }, null)
      );
      await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      // Now go offline and clear DB mocks — must serve from cache.
      setOnline(false);
      mockMessagingFrom.mockClear();

      const result = await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      expect(result).toEqual(PUBLIC_JWK);
      expect(mockMessagingFrom).not.toHaveBeenCalled();
    });
  });

  describe('clearPublicKeyCache', () => {
    it('empties the cache so a later offline lookup misses', async () => {
      // Populate cache online.
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ public_key: PUBLIC_JWK }, null)
      );
      await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      keyManagementService.clearPublicKeyCache();

      // Offline + no cache → falls through to DB query (which now finds nothing).
      setOnline(false);
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'no rows' })
      );

      expect(
        await keyManagementService.getUserPublicKey(OTHER_USER_ID)
      ).toBeNull();
    });
  });
});
