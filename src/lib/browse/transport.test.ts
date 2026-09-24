import { describe, it, expect } from 'vitest';
import type { BrowsePet } from '@/types/applications';
import {
  applyRadiusWithTransport,
  isTransportMatch,
  normalizeTransportStates,
  petTransportsTo,
  shelterTransportsTo,
  stateName,
  transportBadgeLabel,
  transportStateFor,
  transportStatesSummary,
} from './transport';

/** Sunnyside Street Dogs Rescue, Houston TX — ships to NJ (#331). */
function houstonPet(overrides: Partial<BrowsePet> = {}): BrowsePet {
  return {
    id: 'pet-houston',
    shelter_id: 'shelter-houston',
    name: 'Scout',
    species: 'dog',
    breed: 'Lab mix',
    sex: 'female',
    age_years: 3,
    size: 'medium',
    photo_url: null,
    status: 'available',
    notes: null,
    video_url: null,
    transportable: true,
    created_at: '2026-01-01T00:00:00Z',
    shelters: {
      name: 'Sunnyside Street Dogs Rescue',
      city: 'Houston',
      state: 'TX',
      zip: '77002',
      transports: true,
      transport_states: ['NJ', 'NY'],
      transport_note: 'Transport fee $300, ground transport twice a month.',
    },
    ...overrides,
  };
}

/** A local New Jersey rescue that does not transport. */
function newarkPet(overrides: Partial<BrowsePet> = {}): BrowsePet {
  return {
    ...houstonPet(),
    id: 'pet-newark',
    shelter_id: 'shelter-newark',
    name: 'Pickle',
    shelters: {
      name: 'Newark Pet Alliance',
      city: 'Newark',
      state: 'NJ',
      zip: '07102',
      transports: false,
      transport_states: [],
      transport_note: null,
    },
    ...overrides,
  };
}

describe('transport state codes (#331)', () => {
  it('uppercases, de-duplicates, sorts and drops invalid codes', () => {
    expect(
      normalizeTransportStates([' nj ', 'NJ', 'ny', 'ZZ', '', null])
    ).toEqual(['NJ', 'NY']);
    expect(normalizeTransportStates(null)).toEqual([]);
  });

  it('maps codes to full state names', () => {
    expect(stateName('nj')).toBe('New Jersey');
    expect(stateName('ZZ')).toBe('ZZ');
    expect(stateName(null)).toBe('');
  });
});

describe('adopter transport state (#331)', () => {
  it('prefers the explicit state filter', () => {
    expect(transportStateFor(' nj ', '77002')).toBe('NJ');
  });

  it('derives the state from the ZIP when no state is picked', () => {
    expect(transportStateFor('', '07102')).toBe('NJ');
  });

  it('is undefined without a state or usable ZIP', () => {
    expect(transportStateFor('', '')).toBeUndefined();
    expect(transportStateFor(null, '072')).toBeUndefined();
    expect(transportStateFor('ZZ', null)).toBeUndefined();
  });
});

describe('transport matching (#331)', () => {
  it('matches a rescue that ships to the adopter state', () => {
    expect(shelterTransportsTo(houstonPet().shelters, 'nj')).toBe(true);
    expect(shelterTransportsTo(houstonPet().shelters, 'CA')).toBe(false);
    expect(shelterTransportsTo(newarkPet().shelters, 'NJ')).toBe(false);
  });

  it('honours the per-pet opt-out', () => {
    expect(petTransportsTo(houstonPet(), 'NJ')).toBe(true);
    expect(petTransportsTo(houstonPet({ transportable: false }), 'NJ')).toBe(
      false
    );
  });

  it('ignores the rescue-wide switch when no states are listed', () => {
    const pet = houstonPet();
    expect(
      shelterTransportsTo({ ...pet.shelters!, transport_states: [] }, 'NJ')
    ).toBe(false);
  });

  it('badges only pets that are not already local', () => {
    expect(transportBadgeLabel(houstonPet(), 'NJ')).toBe(
      'Transport available to New Jersey'
    );
    expect(isTransportMatch(newarkPet(), 'NJ')).toBe(false);
    expect(transportBadgeLabel(newarkPet(), 'NJ')).toBeNull();
    expect(transportBadgeLabel(houstonPet(), '')).toBeNull();
  });

  it('summarizes a rescue transport list, collapsing long ones', () => {
    const pet = houstonPet();
    expect(transportStatesSummary(pet.shelters)).toBe('New Jersey, New York');
    expect(
      transportStatesSummary({
        transports: true,
        transport_states: ['NJ', 'NY', 'PA', 'CT', 'MA', 'MD', 'DE'],
        transport_note: null,
      })
    ).toBe('7 states');
    expect(transportStatesSummary(newarkPet().shelters)).toBeNull();
  });
});

describe('radius + transport (#331)', () => {
  const houston = houstonPet();
  const newark = newarkPet();

  it('keeps transport matches that the radius would have dropped', () => {
    const result = applyRadiusWithTransport([houston, newark], {
      transportState: 'NJ',
      centerZip: '07102',
      maxMiles: 25,
      includeTransport: true,
    });

    expect(result.map((pet) => pet.id)).toEqual([houston.id, newark.id]);
  });

  it('drops distant pets when transport is switched off', () => {
    const result = applyRadiusWithTransport([houston, newark], {
      transportState: 'NJ',
      centerZip: '07102',
      maxMiles: 25,
      includeTransport: false,
    });

    expect(result.map((pet) => pet.id)).toEqual([newark.id]);
  });

  it('still applies the radius to local pets', () => {
    const result = applyRadiusWithTransport([newark], {
      transportState: 'NJ',
      centerZip: '90210',
      maxMiles: 25,
      includeTransport: true,
    });

    expect(result).toEqual([]);
  });

  it('is a no-op without a radius', () => {
    const pets = [houston, newark];
    expect(
      applyRadiusWithTransport(pets, {
        transportState: 'NJ',
        includeTransport: true,
      })
    ).toEqual(pets);
  });
});
