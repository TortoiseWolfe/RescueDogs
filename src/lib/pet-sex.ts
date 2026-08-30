import type { PetSex } from '@/types/applications';

export const PET_SEX_OPTIONS: ReadonlyArray<{
  value: PetSex;
  label: string;
}> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'neutered_male', label: 'Neutered Male' },
  { value: 'neutered_female', label: 'Neutered Female' },
];

export function formatPetSexLabel(
  sex: PetSex | null | undefined
): string | null {
  if (!sex) return null;
  return PET_SEX_OPTIONS.find((o) => o.value === sex)?.label ?? sex;
}
