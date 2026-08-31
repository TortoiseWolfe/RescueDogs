import { describe, it, expect } from 'vitest';
import {
  hasBrowseLocationFilters,
  normalizeBrowseLocationFilters,
  normalizeState,
  normalizeZip,
} from './location-filters';

describe('browse location filters (#111)', () => {
  it('normalizes state to uppercase trimmed codes', () => {
    expect(normalizeState(' nc ')).toBe('NC');
    expect(normalizeState('')).toBeUndefined();
    expect(normalizeState(null)).toBeUndefined();
  });

  it('normalizes ZIP to five digits for radius center (#280)', () => {
    expect(normalizeZip(' 28801 ')).toBe('28801');
    expect(normalizeZip('28801-1234')).toBe('28801');
    expect(normalizeZip('   ')).toBeUndefined();
    expect(normalizeZip('288')).toBeUndefined();
  });

  it('drops empty fields from filter objects', () => {
    expect(
      normalizeBrowseLocationFilters({ state: ' nc ', centerZip: '  ' })
    ).toEqual({ state: 'NC' });
    expect(
      normalizeBrowseLocationFilters({
        centerZip: '62269',
        maxMiles: 50,
        shelterId: 'abc',
      })
    ).toEqual({ centerZip: '62269', maxMiles: 50, shelterId: 'abc' });
    expect(hasBrowseLocationFilters({ state: '', centerZip: '' })).toBe(false);
    expect(hasBrowseLocationFilters({ state: 'NC' })).toBe(true);
    expect(hasBrowseLocationFilters({ maxMiles: 25 })).toBe(true);
  });
});
