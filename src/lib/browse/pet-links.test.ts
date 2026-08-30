import { describe, it, expect } from 'vitest';
import { petDetailPath, speciesBrowsePath } from './pet-links';

describe('pet-links (#274)', () => {
  it('builds static-export detail paths', () => {
    const id = '44444444-4444-4444-4444-444444444401';
    expect(petDetailPath('dog', id)).toBe(
      `/dogs/detail?id=${encodeURIComponent(id)}`
    );
    expect(petDetailPath('cat', id)).toBe(
      `/cats/detail?id=${encodeURIComponent(id)}`
    );
  });

  it('builds shelter-scoped browse paths', () => {
    const shelterId = '22222222-2222-2222-2222-222222222201';
    expect(speciesBrowsePath('dog', shelterId)).toBe(
      `/dogs?shelter=${encodeURIComponent(shelterId)}`
    );
  });
});
