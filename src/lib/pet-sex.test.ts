import { describe, it, expect } from 'vitest';
import { PET_SEX_OPTIONS, formatPetSexLabel } from './pet-sex';

describe('pet-sex (#273)', () => {
  it('lists four sex options plus unknown in forms', () => {
    expect(PET_SEX_OPTIONS).toHaveLength(4);
    expect(PET_SEX_OPTIONS.map((o) => o.value)).toEqual([
      'male',
      'female',
      'neutered_male',
      'neutered_female',
    ]);
  });

  it('formats labels for display', () => {
    expect(formatPetSexLabel('neutered_male')).toBe('Neutered Male');
    expect(formatPetSexLabel('neutered_female')).toBe('Neutered Female');
    expect(formatPetSexLabel(null)).toBeNull();
  });
});
