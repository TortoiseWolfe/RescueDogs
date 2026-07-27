/**
 * Unit tests for demo session helpers (#68).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEMO_MODE_KEY,
  DEMO_TOUR_DISMISS_KEY,
  DEMO_TOUR_RESTART_EVENT,
  clearDemoMode,
  enterDemoMode,
  getDemoModePortal,
  getTourStep,
  isDemoMode,
  isTourDismissed,
  oppositePortal,
  resolveTourRoleFromPath,
  restartDemoTour,
  setTourDismissed,
  setTourStep,
  switchDemoRoleHref,
} from './demo-session';

describe('demo-session', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('enters and detects demo mode', () => {
    expect(isDemoMode()).toBe(false);
    enterDemoMode('adopter');
    expect(isDemoMode()).toBe(true);
    expect(getDemoModePortal()).toBe('adopter');
    expect(window.sessionStorage.getItem(DEMO_MODE_KEY)).toBe('adopter');
  });

  it('clears demo mode', () => {
    enterDemoMode('shelter');
    clearDemoMode();
    expect(isDemoMode()).toBe(false);
    expect(getDemoModePortal()).toBeNull();
  });

  it('tracks tour dismissal per role', () => {
    expect(isTourDismissed('adopter')).toBe(false);
    setTourDismissed('adopter', true);
    expect(isTourDismissed('adopter')).toBe(true);
    expect(isTourDismissed('shelter')).toBe(false);
    expect(window.localStorage.getItem(DEMO_TOUR_DISMISS_KEY)).toContain(
      'adopter'
    );
  });

  it('tracks tour step per role', () => {
    expect(getTourStep('shelter')).toBe(0);
    setTourStep('shelter', 2);
    expect(getTourStep('shelter')).toBe(2);
  });

  it('restarts tour and dispatches event', () => {
    setTourDismissed('adopter', true);
    setTourStep('adopter', 2);
    const handler = vi.fn();
    window.addEventListener(DEMO_TOUR_RESTART_EVENT, handler);
    restartDemoTour('adopter');
    expect(isTourDismissed('adopter')).toBe(false);
    expect(getTourStep('adopter')).toBe(0);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(DEMO_TOUR_RESTART_EVENT, handler);
  });

  it('builds switch-role sign-in href with demo=1 and switch banner params', () => {
    expect(switchDemoRoleHref('adopter')).toBe(
      '/sign-in?portal=shelter&returnUrl=%2Fshelter&demo=1&switch=1&from=adopter'
    );
    expect(oppositePortal('shelter')).toBe('adopter');
  });

  it('resolves tour role from pathname', () => {
    expect(resolveTourRoleFromPath('/shelter')).toBe('shelter');
    expect(resolveTourRoleFromPath('/shelter/application')).toBe('shelter');
    expect(resolveTourRoleFromPath('/applications')).toBe('adopter');
    expect(resolveTourRoleFromPath('/applications/status')).toBe('adopter');
    expect(resolveTourRoleFromPath('/messages')).toBeNull();
  });
});
