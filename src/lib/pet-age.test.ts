import { describe, it, expect } from 'vitest';
import { combineAgeYears, formatPetAgeLabel, splitAgeYears } from './pet-age';

describe('pet-age (#272)', () => {
  describe('splitAgeYears', () => {
    it('splits legacy 0.5 years into 0 yr 6 mo', () => {
      expect(splitAgeYears(0.5)).toEqual({ years: 0, months: 6 });
    });

    it('splits whole years', () => {
      expect(splitAgeYears(2)).toEqual({ years: 2, months: 0 });
    });

    it('splits fractional years', () => {
      expect(splitAgeYears(2.25)).toEqual({ years: 2, months: 3 });
    });

    it('returns null for missing age', () => {
      expect(splitAgeYears(null)).toBeNull();
    });
  });

  describe('combineAgeYears', () => {
    it('combines 0 yr 4 mo', () => {
      expect(combineAgeYears(0, 4)).toBe(0.33);
    });

    it('combines 0 yr 9 mo', () => {
      expect(combineAgeYears(0, 9)).toBe(0.75);
    });

    it('combines 2 yr 3 mo', () => {
      expect(combineAgeYears(2, 3)).toBe(2.25);
    });

    it('returns null when both zero', () => {
      expect(combineAgeYears(0, 0)).toBeNull();
    });
  });

  describe('formatPetAgeLabel', () => {
    it('formats months only', () => {
      expect(formatPetAgeLabel(0.5)).toBe('6 mo');
      expect(formatPetAgeLabel(combineAgeYears(0, 9))).toBe('9 mo');
    });

    it('formats years only', () => {
      expect(formatPetAgeLabel(2)).toBe('2 yr');
    });

    it('formats years and months', () => {
      expect(formatPetAgeLabel(2.25)).toBe('2 yr 3 mo');
    });
  });
});
