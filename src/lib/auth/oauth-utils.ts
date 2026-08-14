/**
 * OAuth Utility Functions
 * Helpers for detecting and handling OAuth users
 */

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

/** An auth error carried on a callback URL. */
export interface AuthUrlError {
  error: string;
  errorDescription: string | null;
}

/**
 * Read an auth error from a callback URL, checking BOTH the query string and the
 * fragment.
 *
 * Why both (#100): `src/lib/supabase/client.ts` sets `flowType: 'implicit'` because
 * the site is a static export with no server-side code exchange. Supabase's implicit
 * flow returns errors in the URL **fragment** (`#error=...&error_description=...`),
 * not the query string. Code that reads only `location.search` therefore sees no
 * error for the most common real-world case — a user clicking an expired confirmation
 * or password-recovery link.
 *
 * That is not hypothetical: `/auth/callback` displayed the error (it read the hash)
 * while its redirect guard read only the query string, so the page showed the error
 * and then bounced the user to `/sign-in?error=auth_callback_failed` two seconds
 * later, before they could read it. Both call sites now share this one function so
 * they cannot disagree again.
 *
 * @param search - `window.location.search`, with or without the leading `?`
 * @param hash - `window.location.hash`, with or without the leading `#`
 * @returns the error, or null when the URL carries none
 */
export function parseAuthErrorFromUrl(
  search: string,
  hash: string
): AuthUrlError | null {
  const query = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const fragment = new URLSearchParams(
    hash.startsWith('#') ? hash.slice(1) : hash
  );

  // Query first: if a provider ever returns both, the query copy is the canonical one.
  const error = query.get('error') ?? fragment.get('error');
  if (!error) return null;

  return {
    error,
    errorDescription:
      query.get('error_description') ?? fragment.get('error_description'),
  };
}

/**
 * Extract display name from OAuth user metadata using fallback cascade.
 * Priority: full_name > name > user_name > preferred_username > email prefix > "Anonymous User"
 *
 * Provider-specific notes:
 * - Google sets `full_name` and `name`
 * - GitHub sets `name` (the user's display name) and `user_name` (the GitHub
 *   handle). The handle is preferred over email prefix because users with
 *   no display name set on GitHub still have a meaningful identifier.
 * - Other providers may use `preferred_username` (OIDC standard claim).
 *
 * Trims whitespace at each tier so a metadata field of "   " falls through
 * to the next tier instead of producing a whitespace-only display name.
 *
 * @param user - Supabase User object
 * @returns Display name string, never null
 */
export function extractOAuthDisplayName(user: User | null): string {
  if (!user) return 'Anonymous User';

  const meta = user.user_metadata ?? {};
  const tiers = [
    meta.full_name,
    meta.name,
    meta.user_name,
    meta.preferred_username,
  ];
  for (const tier of tiers) {
    if (typeof tier === 'string') {
      const trimmed = tier.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  // Email prefix fallback
  const email = user.email;
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix && prefix.length > 0) return prefix;
  }

  return 'Anonymous User';
}

/**
 * Extract avatar URL from OAuth user metadata
 *
 * @param user - Supabase User object
 * @returns Avatar URL string or null if not available
 */
export function extractOAuthAvatarUrl(user: User | null): string | null {
  return user?.user_metadata?.avatar_url || null;
}

/**
 * Check if a user signed in via OAuth (Google, GitHub, etc.)
 * OAuth users don't have a password set in Supabase auth
 *
 * @param user - Supabase User object
 * @returns true if user signed in via OAuth provider
 */
export function isOAuthUser(user: User | null): boolean {
  if (!user) return false;

  // Check app_metadata.provider - set by Supabase on OAuth sign-in
  const provider = user.app_metadata?.provider;
  if (provider && provider !== 'email') {
    return true;
  }

  // Fallback: Check identities array for non-email providers
  const identities = user.identities || [];
  return identities.some(
    (identity) => identity.provider && identity.provider !== 'email'
  );
}

/**
 * Get the OAuth provider name for display
 *
 * @param user - Supabase User object
 * @returns Provider name (e.g., "Google", "GitHub") or null if email user
 */
export function getOAuthProvider(user: User | null): string | null {
  if (!user) return null;

  const provider = user.app_metadata?.provider;
  if (provider && provider !== 'email') {
    // Capitalize first letter
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  // Check identities
  const oauthIdentity = user.identities?.find(
    (i) => i.provider && i.provider !== 'email'
  );
  if (oauthIdentity) {
    return (
      oauthIdentity.provider.charAt(0).toUpperCase() +
      oauthIdentity.provider.slice(1)
    );
  }

  return null;
}

const logger = createLogger('lib:auth:oauth-utils');

/**
 * Seed display_name when it is null/blank (#105).
 * Uses the same cascade as extractOAuthDisplayName (works for email/password
 * and OAuth). Never overwrites a name the user already set.
 *
 * @returns true if display_name was written
 */
export async function ensureDisplayNameSeeded(user: User): Promise<boolean> {
  const supabase = createClient();

  try {
    const { data: profile, error: queryError } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    if (queryError || !profile) {
      logger.error('Failed to query profile for display_name seed', {
        userId: user.id,
        error: queryError?.message,
      });
      return false;
    }

    if (profile.display_name?.trim()) {
      return false;
    }

    const seed = extractOAuthDisplayName(user).slice(0, 100);
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ display_name: seed })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to seed display_name', {
        userId: user.id,
        error: updateError.message,
      });
      return false;
    }

    logger.info('display_name seeded for discoverability', {
      userId: user.id,
    });
    return true;
  } catch (err) {
    logger.error('Unexpected error seeding display_name', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Populate user_profiles with OAuth metadata (display_name, avatar_url)
 * Only populates NULL values - never overwrites existing data (FR-003)
 * Errors are logged but do not block OAuth flow (NFR-001)
 *
 * @param user - Supabase User object with OAuth metadata
 * @returns true if any field was updated, false otherwise
 */
export async function populateOAuthProfile(user: User): Promise<boolean> {
  const supabase = createClient();

  try {
    // Query current profile
    const { data: profile, error: queryError } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (queryError || !profile) {
      logger.error('Failed to query user profile for OAuth population', {
        userId: user.id,
        error: queryError?.message,
      });
      return false;
    }

    // Check what needs updating (only NULL / blank values)
    const updates: { display_name?: string; avatar_url?: string } = {};

    if (!profile.display_name?.trim()) {
      updates.display_name = extractOAuthDisplayName(user).slice(0, 100);
    }

    if (profile.avatar_url === null) {
      const oauthAvatar = extractOAuthAvatarUrl(user);
      if (oauthAvatar) {
        updates.avatar_url = oauthAvatar;
      }
    }

    // Nothing to update
    if (Object.keys(updates).length === 0) {
      logger.debug('OAuth profile already populated, skipping', {
        userId: user.id,
      });
      return false;
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update user profile with OAuth data', {
        userId: user.id,
        error: updateError.message,
      });
      return false;
    }

    logger.info('OAuth profile populated successfully', {
      userId: user.id,
      updatedFields: Object.keys(updates),
    });

    return true;
  } catch (err) {
    logger.error('Unexpected error populating OAuth profile', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
