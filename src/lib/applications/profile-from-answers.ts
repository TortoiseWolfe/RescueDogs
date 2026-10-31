import type { HousingType, ProfileSnapshot } from '@/types/applications';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const NAME_ERROR = 'Enter a name between 2 and 100 characters';

function outOfRange(value: unknown, min: number, max: number): boolean {
  if (value === undefined || value === null || value === '') return false;
  const n = typeof value === 'number' ? value : Number(value);
  return !Number.isInteger(n) || n < min || n > max;
}

/**
 * Check the answers that feed adopter_profiles columns with CHECK
 * constraints: full_name 2-100 characters, household_adults 1-20 and
 * household_children 0-20. A value that breaks one makes the profile upsert
 * fail at submit, so show these messages before submitting. A missing answer
 * is not an error here; whether a question is required is checked elsewhere.
 */
export function profileAnswerErrors(
  answers: ReadonlyMap<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = asString(answers.get('con.full_name'));
  if (name !== null && (name.length < 2 || name.length > 100)) {
    errors['con.full_name'] = NAME_ERROR;
  }
  if (outOfRange(answers.get('hh.adults_count'), 1, 20)) {
    errors['hh.adults_count'] = 'Enter a whole number from 1 to 20';
  }
  if (outOfRange(answers.get('hh.children_count'), 0, 20)) {
    errors['hh.children_count'] = 'Enter a whole number from 0 to 20';
  }
  return errors;
}

/**
 * Rebuild the legacy profile_snapshot columns from bank answers so the
 * existing applications.profile_snapshot path keeps working alongside
 * answers_snapshot (#446 / #337).
 */
export function profileSnapshotFromAnswers(
  answers: ReadonlyMap<string, unknown>,
  fallbackName = 'Applicant'
): ProfileSnapshot {
  const fullName = asString(answers.get('con.full_name')) ?? fallbackName;

  const phoneRaw = answers.get('con.phone');
  const phoneRec = asRecord(phoneRaw);
  const phone = asString(phoneRec?.number) ?? asString(phoneRaw);

  const address = asRecord(answers.get('con.address'));

  const homeType = asString(answers.get('hou.home_type'));
  const ownRent = asString(answers.get('hou.own_rent'));
  const housing_type = toHousingType(homeType, ownRent);

  const landlordAllows = asString(answers.get('hou.landlord_allows'));
  const landlordApproval =
    landlordAllows === 'yes' ? true : landlordAllows === 'no' ? false : null;

  const landlordContactRaw = answers.get('hou.landlord_contact');
  const landlordContactRec = asRecord(landlordContactRaw);
  const landlord_contact =
    asString(landlordContactRec?.note) ??
    asString(landlordContactRec?.name) ??
    asString(landlordContactRaw);

  const hasYard = asBool(answers.get('yrd.has_yard')) ?? false;
  const fenced = asString(answers.get('yrd.fenced'));
  const yard_fenced =
    fenced === 'fully' || fenced === 'partly'
      ? true
      : fenced === 'no'
        ? false
        : null;

  const petCurrent = asRecord(answers.get('pet.current'));
  const other_pets = asString(petCurrent?.legacy_note);

  const vet = asRecord(answers.get('vet.contact'));
  const experience = asRecord(answers.get('trn.experience_level'));

  return {
    full_name: fullName,
    phone,
    address_line: asString(address?.street),
    city: asString(address?.city),
    state: asString(address?.state),
    zip: asString(address?.zip),
    housing_type,
    landlord_approval: landlordApproval,
    landlord_contact,
    has_yard: hasYard,
    yard_fenced,
    household_adults: asInt(answers.get('hh.adults_count'), 1),
    household_children: asInt(answers.get('hh.children_count'), 0),
    other_pets,
    vet_name: asString(vet?.name),
    vet_phone: asString(vet?.phone),
    experience: asString(experience?.describe),
  };
}

function toHousingType(
  homeType: string | null,
  ownRent: string | null
): HousingType {
  if (ownRent === 'own' && homeType === 'house') return 'own_house';
  if (ownRent === 'own' && (homeType === 'condo' || homeType === 'townhouse')) {
    return 'own_condo';
  }
  if (ownRent === 'rent' && homeType === 'house') return 'rent_house';
  if (ownRent === 'rent' && homeType === 'apartment') return 'rent_apartment';
  if (homeType === 'other' || ownRent === 'family_other') return 'other';
  if (ownRent === 'own') return 'own_house';
  if (ownRent === 'rent') return 'rent_apartment';
  return 'other';
}
