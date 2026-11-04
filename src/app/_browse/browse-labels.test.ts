import { describe, it, expect } from 'vitest';
import type { BrowsePet } from '@/types/applications';
import { basicsParts, locationLabel } from './browse-labels';

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
  video_url: null,
  transportable: true,
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

  it('formats breed, size, and age as stacked parts', () => {
    expect(basicsParts(basePet)).toEqual({
      breed: 'Beagle Mix',
      size: 'Medium',
      age: '2 years',
    });
  });

  it('title-cases a slashed breed', () => {
    expect(
      basicsParts({
        ...basePet,
        breed: 'papillion/spaniel',
      }).breed
    ).toBe('Papillion/Spaniel');
  });

  it('formats months-only age (#272)', () => {
    expect(
      basicsParts({
        ...basePet,
        age_years: 0.5,
      }).age
    ).toBe('6 months');
  });

  it('uses empty parts when no basics', () => {
    expect(
      basicsParts({
        ...basePet,
        breed: null,
        size: null,
        age_years: null,
      })
    ).toEqual({
      breed: null,
      size: null,
      age: null,
    });
  });
});
