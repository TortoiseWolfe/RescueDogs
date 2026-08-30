import { describe, it, expect } from 'vitest';
import type { BrowsePet } from '@/types/applications';
import { basicsLabel, locationLabel } from './browse-labels';

const basePet: BrowsePet = {
  id: 'pet-1',
  shelter_id: 'shelter-1',
  name: 'Biscuit',
  species: 'dog',
  breed: 'Beagle mix',
  sex: 'female',
  age_years: 2,
  size: 'medium',
  photo_url: null,
  status: 'available',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  shelters: {
    name: 'Second Chance Rescue',
    city: 'Asheville',
    state: 'NC',
    zip: '28801',
  },
};

describe('browse pet labels (#112)', () => {
  it('formats city and state', () => {
    expect(locationLabel(basePet)).toBe('Asheville, NC');
  });

  it('falls back to shelter name', () => {
    expect(
      locationLabel({
        ...basePet,
        shelters: {
          name: 'Second Chance Rescue',
          city: null,
          state: null,
          zip: null,
        },
      })
    ).toBe('Second Chance Rescue');
  });

  it('formats breed, size, and age', () => {
    expect(basicsLabel(basePet)).toBe('Beagle mix · medium · 2 yr');
  });

  it('formats months-only age (#272)', () => {
    expect(
      basicsLabel({
        ...basePet,
        age_years: 0.5,
      })
    ).toBe('Beagle mix · medium · 6 mo');
  });

  it('uses placeholder when no basics', () => {
    expect(
      basicsLabel({
        ...basePet,
        breed: null,
        size: null,
        age_years: null,
      })
    ).toBe('Details coming soon');
  });
});
