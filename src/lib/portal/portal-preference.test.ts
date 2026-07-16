import { describe, it, expect, beforeEach } from 'vitest';
import {
  PORTAL_PREFERENCE_KEY,
  buildSignInHref,
  buildSignUpHref,
  clearPortalPreference,
  getPortalPreference,
  isPortalType,
  setPortalPreference,
} from './portal-preference';

describe('portal-preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('validates portal types', () => {
    expect(isPortalType('adopter')).toBe(true);
    expect(isPortalType('shelter')).toBe(true);
    expect(isPortalType('admin')).toBe(false);
    expect(isPortalType(null)).toBe(false);
  });

  it('stores and clears preference', () => {
    expect(getPortalPreference()).toBeNull();
    setPortalPreference('shelter');
    expect(getPortalPreference()).toBe('shelter');
    expect(window.localStorage.getItem(PORTAL_PREFERENCE_KEY)).toBe('shelter');
    clearPortalPreference();
    expect(getPortalPreference()).toBeNull();
  });

  it('builds sign-in href with portal defaults', () => {
    expect(buildSignInHref('adopter')).toBe(
      '/sign-in?portal=adopter&returnUrl=%2Fapplications'
    );
    expect(buildSignInHref('shelter')).toBe(
      '/sign-in?portal=shelter&returnUrl=%2Fshelter'
    );
  });

  it('builds sign-up href with portal defaults', () => {
    expect(buildSignUpHref('adopter')).toBe(
      '/sign-up?portal=adopter&returnUrl=%2Fapplications'
    );
  });

  it('honors safe custom returnUrl', () => {
    expect(buildSignInHref('adopter', '/adopt')).toBe(
      '/sign-in?portal=adopter&returnUrl=%2Fadopt'
    );
  });
});
