import type { BrowsePet } from '@/types/applications';

export function locationLabel(pet: BrowsePet): string | null {
  const city = pet.shelters?.city?.trim();
  const state = pet.shelters?.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return pet.shelters?.name ?? null;
}

export function basicsLabel(pet: BrowsePet): string {
  const parts = [
    pet.breed,
    pet.size,
    pet.age_years != null ? `${pet.age_years} yr` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Details coming soon';
}
