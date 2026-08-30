/** Max years on pet intake forms (#272). Matches DB check. */
export const PET_AGE_MAX_YEARS = 40;

export type PetAgeParts = {
  years: number;
  months: number;
};

/**
 * Split stored age_years into whole years + months for shelter forms (#272).
 * Uses total months to avoid float drift (e.g. 0.5 → 0 yr / 6 mo).
 */
export function splitAgeYears(
  ageYears: number | null | undefined
): PetAgeParts | null {
  if (ageYears == null || Number.isNaN(ageYears)) return null;
  const totalMonths = Math.round(ageYears * 12);
  if (totalMonths <= 0) return { years: 0, months: 0 };
  const years = Math.min(PET_AGE_MAX_YEARS, Math.floor(totalMonths / 12));
  const months = totalMonths - years * 12;
  return { years, months };
}

/**
 * Combine years + months dropdown values into age_years for storage.
 * Both zero → null (unknown / not provided).
 */
export function combineAgeYears(years: number, months: number): number | null {
  if (years === 0 && months === 0) return null;
  const total = years + months / 12;
  return Math.round(total * 100) / 100;
}

/** Human label for browse cards and adopt UI (#272). */
export function formatPetAgeLabel(
  ageYears: number | null | undefined
): string | null {
  const parts = splitAgeYears(ageYears);
  if (!parts) return null;
  const { years, months } = parts;
  if (years === 0 && months === 0) return null;
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}
