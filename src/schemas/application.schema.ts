import { z } from 'zod';
import { isRenting } from '@/types/applications';
import type { HousingType, ProfileSnapshot } from '@/types/applications';

/**
 * Adoption application form validation schema.
 * Validates the "universal application" answers that get upserted into
 * adopter_profiles and frozen into applications.profile_snapshot.
 *
 * DB CHECK constraints are the floor; this schema is the UX layer with
 * friendly messages plus the one rule the DB intentionally leaves to Zod:
 * landlord approval is required when renting.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((str) => str.trim())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be less than ${max} characters`)
    );

const optionalTrimmed = (max: number, label: string) =>
  z.preprocess(
    (val) => {
      if (typeof val !== 'string') return val;
      const trimmedVal = val.trim();
      return trimmedVal === '' ? undefined : trimmedVal;
    },
    z
      .string()
      .max(max, `${label} must be less than ${max} characters`)
      .optional()
  );

export const HOUSING_TYPE_OPTIONS: Array<{
  value: HousingType;
  label: string;
}> = [
  { value: 'own_house', label: 'Own — house' },
  { value: 'own_condo', label: 'Own — condo / townhome' },
  { value: 'rent_house', label: 'Rent — house' },
  { value: 'rent_apartment', label: 'Rent — apartment' },
  { value: 'other', label: 'Other' },
];

export const applicationSchema = z
  .object({
    // Loose UUID shape (8-4-4-4-12 hex): Postgres accepts non-RFC-4122
    // UUIDs (our demo seeds use fixed ids like 4444...4401) but Zod v4's
    // strict .uuid() rejects them on version/variant bits.
    pet_id: z
      .string()
      .regex(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
        'Please choose a pet to apply for'
      ),

    // ── About You ──────────────────────────────────────────────
    full_name: trimmed(2, 100, 'Full name'),
    phone: optionalTrimmed(30, 'Phone'),
    address_line: optionalTrimmed(200, 'Street address'),
    city: optionalTrimmed(100, 'City'),
    state: optionalTrimmed(50, 'State'),
    zip: optionalTrimmed(20, 'ZIP'),

    // ── Your Home ──────────────────────────────────────────────
    housing_type: z.enum(
      ['own_house', 'own_condo', 'rent_house', 'rent_apartment', 'other'],
      { message: 'Please select your housing situation' }
    ),
    landlord_approval: z.boolean().optional(),
    landlord_contact: optionalTrimmed(200, 'Landlord contact'),
    has_yard: z.boolean().default(false),
    yard_fenced: z.boolean().optional(),

    // ── Household & Pets ───────────────────────────────────────
    household_adults: z.coerce
      .number()
      .int('Adults must be a whole number')
      .min(1, 'At least one adult is required')
      .max(20, 'Adults must be 20 or fewer'),
    household_children: z.coerce
      .number()
      .int('Children must be a whole number')
      .min(0, 'Children cannot be negative')
      .max(20, 'Children must be 20 or fewer'),
    other_pets: optionalTrimmed(1000, 'Other pets'),

    // ── References & Experience ────────────────────────────────
    vet_name: optionalTrimmed(120, 'Veterinarian name'),
    vet_phone: optionalTrimmed(30, 'Veterinarian phone'),
    experience: optionalTrimmed(2000, 'Experience'),

    // ── This Pet ───────────────────────────────────────────────
    why_this_pet: optionalTrimmed(2000, 'Why this pet'),
  })
  .refine(
    (data) => !isRenting(data.housing_type) || data.landlord_approval === true,
    {
      message:
        "Renters need their landlord's approval before a shelter can place a pet",
      path: ['landlord_approval'],
    }
  );

export type ApplicationFormData = z.infer<typeof applicationSchema>;

/**
 * The profile fields of the form (everything except pet_id/why_this_pet),
 * shaped for adopter_profiles upsert and profile_snapshot freezing.
 */
export function toProfileSnapshot(data: ApplicationFormData): ProfileSnapshot {
  return {
    full_name: data.full_name,
    phone: data.phone ?? null,
    address_line: data.address_line ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    zip: data.zip ?? null,
    housing_type: data.housing_type,
    landlord_approval: data.landlord_approval ?? null,
    landlord_contact: data.landlord_contact ?? null,
    has_yard: data.has_yard,
    yard_fenced: data.yard_fenced ?? null,
    household_adults: data.household_adults,
    household_children: data.household_children,
    other_pets: data.other_pets ?? null,
    vet_name: data.vet_name ?? null,
    vet_phone: data.vet_phone ?? null,
    experience: data.experience ?? null,
  };
}
