import { describe, it, expect } from 'vitest';
import type { BrowsePet } from '@/types/applications';
import {
  filterBrowsePetsByRadius,
  milesBetween,
  normalizeCenterZip,
  normalizeMaxMiles,
} from './distance';

const basePet = (zip: string | null): BrowsePet =>
  ({
    id: 'pet-1',
    shelter_id: 'shelter-1',
    name: 'Test',
    species: 'dog',
    breed: null,
    sex: null,
    age_years: null,
    size: null,
    photo_url: null,
    status: 'available',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    shelters: {
      name: 'Rescue',
      city: 'Test',
      state: 'IL',
      zip,
    },
  }) as BrowsePet;

describe('browse distance (#280)', () => {
  it('normalizes center ZIP to five digits', () => {
    expect(normalizeCenterZip(' 62269 ')).toBe('62269');
    expect(normalizeCenterZip('6226')).toBeUndefined();
  });

  it('normalizes max miles', () => {
    expect(normalizeMaxMiles('50')).toBe(50);
    expect(normalizeMaxMiles('')).toBeUndefined();
  });

  it('computes miles between coordinates', () => {
    const miles = milesBetween(38.627, -90.199, 38.592, -89.911);
    expect(miles).toBeGreaterThan(10);
    expect(miles).toBeLessThan(50);
  });

  it('filters pets within radius of center ZIP', () => {
    const near = basePet('62269');
    const far = basePet('10001');
    const filtered = filterBrowsePetsByRadius([near, far], '62269', 30);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('pet-1');
  });
});
