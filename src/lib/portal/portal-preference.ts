/**
 * Local last-portal preference for the adopter / shelter chooser (#48).
 * Preference only — never the source of truth for access (membership wins).
 */

export type PortalType = 'adopter' | 'shelter';

export type PortalAuthIntent = 'sign-in' | 'sign-up';

export const PORTAL_PREFERENCE_KEY = 'raised-paws-portal';

export const PORTAL_DEFAULT_RETURN: Record<PortalType, string> = {
  adopter: '/applications',
  shelter: '/shelter',
};

export function isPortalType(
  value: string | null | undefined
): value is PortalType {
  return value === 'adopter' || value === 'shelter';
}

export function getPortalPreference(): PortalType | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PORTAL_PREFERENCE_KEY);
    return isPortalType(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setPortalPreference(portal: PortalType): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PORTAL_PREFERENCE_KEY, portal);
  } catch {
    // ignore quota / private mode
  }
}

export function clearPortalPreference(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PORTAL_PREFERENCE_KEY);
  } catch {
    // ignore
  }
}

function resolveReturnUrl(
  portal: PortalType,
  returnUrl?: string | null
): string {
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return returnUrl;
  }
  return PORTAL_DEFAULT_RETURN[portal];
}

/** Public seed accounts (README Live Demo). Safe to ship in the client. */
export const DEMO_CREDENTIALS: Record<
  PortalType,
  { email: string; password: string }
> = {
  adopter: { email: 'adopter@demo.test', password: 'DemoPass123!' },
  shelter: { email: 'staff@demo.test', password: 'DemoPass123!' },
};

export type BuildAuthHrefOptions = {
  /** When true, sign-in links carry demo=1 so SignInForm prefills (#59). */
  demo?: boolean;
};

export function buildSignInHref(
  portal: PortalType,
  returnUrl?: string | null,
  options?: BuildAuthHrefOptions
): string {
  const params = new URLSearchParams({
    portal,
    returnUrl: resolveReturnUrl(portal, returnUrl),
  });
  if (options?.demo) {
    params.set('demo', '1');
  }
  return `/sign-in?${params.toString()}`;
}

export function buildSignUpHref(
  portal: PortalType,
  returnUrl?: string | null
): string {
  const params = new URLSearchParams({
    portal,
    returnUrl: resolveReturnUrl(portal, returnUrl),
  });
  return `/sign-up?${params.toString()}`;
}

export function buildPortalAuthHref(
  portal: PortalType,
  intent: PortalAuthIntent = 'sign-in',
  returnUrl?: string | null,
  options?: BuildAuthHrefOptions
): string {
  return intent === 'sign-up'
    ? buildSignUpHref(portal, returnUrl)
    : buildSignInHref(portal, returnUrl, options);
}
