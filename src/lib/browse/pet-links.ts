import type { PetSpecies } from '@/types/applications';

/** Static-export-friendly pet detail URL (#274). */
export function petDetailPath(species: PetSpecies, petId: string): string {
  const segment = species === 'dog' ? 'dogs' : 'cats';
  return `/${segment}/detail?id=${encodeURIComponent(petId)}`;
}

/** Shelter-scoped browse URL for Petfinder “see all our dogs” links (#274). */
export function speciesBrowsePath(
  species: PetSpecies,
  shelterId: string
): string {
  const segment = species === 'dog' ? 'dogs' : 'cats';
  return `/${segment}?shelter=${encodeURIComponent(shelterId)}`;
}
