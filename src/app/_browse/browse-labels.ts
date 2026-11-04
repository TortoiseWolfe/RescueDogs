import type { BrowsePet, PetSize } from '@/types/applications';
import { formatPetAgePhrase } from '@/lib/pet-age';

export function locationLabel(pet: BrowsePet): string | null {
  const city = pet.shelters?.city?.trim();
  const state = pet.shelters?.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return pet.shelters?.name ?? null;
}

const SIZE_LABELS: Record<PetSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

export function formatPetSizeLabel(size: BrowsePet['size']): string | null {
  if (!size) return null;
  return SIZE_LABELS[size] ?? null;
}

/** Display-only title case: "bully mix" → "Bully Mix", "papillion/spaniel" → "Papillion/Spaniel". */
export function formatPetBreedLabel(
  breed: string | null | undefined
): string | null {
  const raw = breed?.trim();
  if (!raw) return null;
  return raw
    .split(/(\s+|\/)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token) || token === '/') return token;
      if (token.length > 1 && token === token.toUpperCase()) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join('');
}

export function basicsParts(pet: BrowsePet): {
  breed: string | null;
  size: string | null;
  age: string | null;
} {
  return {
    breed: formatPetBreedLabel(pet.breed),
    size: formatPetSizeLabel(pet.size),
    age: formatPetAgePhrase(pet.age_years),
  };
}
