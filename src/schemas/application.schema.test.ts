import { describe, it, expect } from 'vitest';
import {
  applicationSchema,
  toProfileSnapshot,
  type ApplicationFormData,
} from './application.schema';

const VALID_BASE = {
  pet_id: '44444444-4444-4444-4444-444444444401',
  full_name: 'Dana Adopter',
  housing_type: 'own_house',
  has_yard: true,
  household_adults: 2,
  household_children: 1,
};

describe('applicationSchema', () => {
  it('accepts a minimal valid owner application', () => {
    const result = applicationSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  it('requires landlord approval when renting', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      housing_type: 'rent_apartment',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['landlord_approval']);
    }
  });

  it('landlord_approval=false is not enough when renting', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      housing_type: 'rent_house',
      landlord_approval: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts renters with landlord approval', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      housing_type: 'rent_house',
      landlord_approval: true,
      landlord_contact: 'Riverbend Property Mgmt',
    });
    expect(result.success).toBe(true);
  });

  it('does not require landlord approval for owners', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      housing_type: 'own_condo',
      landlord_approval: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid pet id', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      pet_id: 'biscuit',
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one adult in the household', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      household_adults: 0,
    });
    expect(result.success).toBe(false);
  });

  it('coerces numeric strings from form inputs', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      household_adults: '2',
      household_children: '0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.household_adults).toBe(2);
      expect(result.data.household_children).toBe(0);
    }
  });

  it('trims whitespace and treats empty optionals as undefined', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      full_name: '  Dana Adopter  ',
      phone: '',
      vet_name: '  Haw Creek Animal Hospital ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe('Dana Adopter');
      expect(result.data.phone).toBeUndefined();
      expect(result.data.vet_name).toBe('Haw Creek Animal Hospital');
    }
  });

  it('rejects names that are too short', () => {
    const result = applicationSchema.safeParse({
      ...VALID_BASE,
      full_name: 'D',
    });
    expect(result.success).toBe(false);
  });
});

describe('toProfileSnapshot', () => {
  it('produces a DB-shaped snapshot with nulls for missing optionals', () => {
    const parsed = applicationSchema.parse({
      ...VALID_BASE,
      why_this_pet: 'Best dog ever',
    }) as ApplicationFormData;
    const snapshot = toProfileSnapshot(parsed);

    expect(snapshot).toMatchObject({
      full_name: 'Dana Adopter',
      housing_type: 'own_house',
      has_yard: true,
      household_adults: 2,
      household_children: 1,
      phone: null,
      landlord_approval: null,
      vet_name: null,
    });
    // Form-only fields never leak into the snapshot
    expect(snapshot).not.toHaveProperty('pet_id');
    expect(snapshot).not.toHaveProperty('why_this_pet');
  });
});
