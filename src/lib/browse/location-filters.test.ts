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

  it('keeps exact ZIP after trim', () => {
    expect(normalizeZip(' 28801 ')).toBe('28801');
    expect(normalizeZip('28801-1234')).toBe('28801-1234');
    expect(normalizeZip('   ')).toBeUndefined();
  });

  it('drops empty fields from filter objects', () => {
    expect(
      normalizeBrowseLocationFilters({ state: ' nc ', zip: '  ' })
    ).toEqual({ state: 'NC' });
    expect(hasBrowseLocationFilters({ state: '', zip: '' })).toBe(false);
    expect(hasBrowseLocationFilters({ state: 'NC' })).toBe(true);
  });
});
