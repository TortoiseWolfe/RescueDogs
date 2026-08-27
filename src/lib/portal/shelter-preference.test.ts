import { describe, it, expect, beforeEach } from 'vitest';
import {
  LAST_SHELTER_PREFERENCE_KEY,
  clearLastShelterPreference,
  getLastShelterPreference,
  isShelterId,
  pickActiveMembership,
  setLastShelterPreference,
} from './shelter-preference';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('shelter-preference (#261)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('validates shelter UUIDs', () => {
    expect(isShelterId(A)).toBe(true);
    expect(isShelterId('not-a-uuid')).toBe(false);
    expect(isShelterId(null)).toBe(false);
  });

  it('stores and clears preference', () => {
    expect(getLastShelterPreference()).toBeNull();
    setLastShelterPreference(A);
    expect(getLastShelterPreference()).toBe(A);
    expect(window.localStorage.getItem(LAST_SHELTER_PREFERENCE_KEY)).toBe(A);
    clearLastShelterPreference();
    expect(getLastShelterPreference()).toBeNull();
  });

  it('ignores invalid ids when writing', () => {
    setLastShelterPreference('nope');
    expect(getLastShelterPreference()).toBeNull();
  });

  it('pickActiveMembership prefers a stored id still in the list', () => {
    const list = [
      { shelterId: A, shelterName: 'Alpha' },
      { shelterId: B, shelterName: 'Beta' },
    ];
    expect(pickActiveMembership(list, B)?.shelterId).toBe(B);
  });

  it('pickActiveMembership falls back to the first row when preference is stale', () => {
    const list = [
      { shelterId: A, shelterName: 'Alpha' },
      { shelterId: B, shelterName: 'Beta' },
    ];
    expect(
      pickActiveMembership(list, '33333333-3333-4333-8333-333333333333')
        ?.shelterId
    ).toBe(A);
    expect(pickActiveMembership(list, null)?.shelterId).toBe(A);
  });

  it('pickActiveMembership returns null for an empty list', () => {
    expect(pickActiveMembership([], A)).toBeNull();
  });
});
