/**
 * Last-selected shelter for staff on 2+ rescues (#261).
 * Preference only — never the source of truth for access (membership wins).
 */

export const LAST_SHELTER_PREFERENCE_KEY = 'raised-paws-last-shelter';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isShelterId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function getLastShelterPreference(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_SHELTER_PREFERENCE_KEY);
    return isShelterId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setLastShelterPreference(shelterId: string): void {
  if (typeof window === 'undefined') return;
  if (!isShelterId(shelterId)) return;
  try {
    window.localStorage.setItem(LAST_SHELTER_PREFERENCE_KEY, shelterId);
  } catch {
    // ignore quota / private mode
  }
}

export function clearLastShelterPreference(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAST_SHELTER_PREFERENCE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Pick the active membership from a list: stored preference if still valid,
 * otherwise the first row (stable order from the service).
 */
export function pickActiveMembership<T extends { shelterId: string }>(
  memberships: T[],
  preferredId: string | null = getLastShelterPreference()
): T | null {
  if (memberships.length === 0) return null;
  if (preferredId) {
    const match = memberships.find((m) => m.shelterId === preferredId);
    if (match) return match;
  }
  return memberships[0] ?? null;
}
