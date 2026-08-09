/**
 * Demo session helpers for the guided tour + role switch (#68).
 *
 * Demo mode is sessionStorage so it survives sign-in navigation within the
 * tab but clears when the tab closes. Tour dismissal is localStorage so
 * Restart Demo Tour can restore callouts in the same browser.
 */

import {
  buildSignInHref,
  getPortalPreference,
  isPortalType,
  type PortalType,
} from '@/lib/portal/portal-preference';

export const DEMO_MODE_KEY = 'raised-paws-demo-mode';
export const DEMO_TOUR_DISMISS_KEY = 'raised-paws-demo-tour-dismissed';
export const DEMO_TOUR_STEP_KEY = 'raised-paws-demo-tour-step';
export const DEMO_TOUR_RESTART_EVENT = 'raised-paws-demo-tour-restart';

/** Seeded Tiger application (formerly Biscuit; README Live Demo). */
export const DEMO_TIGER_APPLICATION_ID = '55555555-5555-5555-5555-555555555501';
/** @deprecated Use DEMO_TIGER_APPLICATION_ID */
export const DEMO_BISCUIT_APPLICATION_ID = DEMO_TIGER_APPLICATION_ID;

export type DemoTourDismissState = Partial<Record<PortalType, boolean>>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function enterDemoMode(portal?: PortalType): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(
      DEMO_MODE_KEY,
      portal && isPortalType(portal) ? portal : '1'
    );
  } catch {
    // ignore quota / private mode
  }
}

export function isDemoMode(): boolean {
  if (!canUseStorage()) return false;
  try {
    return Boolean(window.sessionStorage.getItem(DEMO_MODE_KEY));
  } catch {
    return false;
  }
}

export function getDemoModePortal(): PortalType | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(DEMO_MODE_KEY);
    if (isPortalType(raw)) return raw;
    if (raw) return getPortalPreference();
    return null;
  } catch {
    return null;
  }
}

export function clearDemoMode(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    // ignore
  }
}

export function readTourDismissed(): DemoTourDismissState {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(DEMO_TOUR_DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DemoTourDismissState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isTourDismissed(role: PortalType): boolean {
  return Boolean(readTourDismissed()[role]);
}

export function setTourDismissed(role: PortalType, dismissed = true): void {
  if (!canUseStorage()) return;
  try {
    const next = { ...readTourDismissed(), [role]: dismissed };
    window.localStorage.setItem(DEMO_TOUR_DISMISS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getTourStep(role: PortalType): number {
  if (!canUseStorage()) return 0;
  try {
    const raw = window.sessionStorage.getItem(`${DEMO_TOUR_STEP_KEY}-${role}`);
    const n = raw == null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setTourStep(role: PortalType, step: number): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(
      `${DEMO_TOUR_STEP_KEY}-${role}`,
      String(Math.max(0, step))
    );
  } catch {
    // ignore
  }
}

/** Clear dismissal + step for one or both roles and notify listeners. */
export function restartDemoTour(role?: PortalType): void {
  if (!canUseStorage()) return;
  const roles: PortalType[] = role ? [role] : ['adopter', 'shelter'];
  for (const r of roles) {
    setTourDismissed(r, false);
    setTourStep(r, 0);
  }
  window.dispatchEvent(
    new CustomEvent(DEMO_TOUR_RESTART_EVENT, { detail: { role: role ?? null } })
  );
}

/**
 * Portal-scoped demo sign-in for the opposite role.
 * Includes demo=1 (prefill), switch=1 (explain banner), and from= (copy).
 */
export function switchDemoRoleHref(current: PortalType): string {
  const next = oppositePortal(current);
  const base = buildSignInHref(next, undefined, { demo: true });
  const params = new URLSearchParams();
  params.set('switch', '1');
  params.set('from', current);
  return `${base}&${params.toString()}`;
}

export function oppositePortal(current: PortalType): PortalType {
  return current === 'adopter' ? 'shelter' : 'adopter';
}

/**
 * Infer which demo tour role fits the current path.
 * Shelter routes win; otherwise adopter application routes.
 */
export function resolveTourRoleFromPath(pathname: string): PortalType | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/shelter' || path.startsWith('/shelter/')) return 'shelter';
  if (path === '/applications' || path.startsWith('/applications/')) {
    return 'adopter';
  }
  return null;
}
