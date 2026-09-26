import { validatePetPhotoFile } from './upload';

export interface PetPhotoSelection {
  /** Valid files that fit in the remaining slots, in the order picked. */
  accepted: File[];
  /** Plain-language notes for anything left out; empty when all files fit. */
  notices: string[];
}

/**
 * Decide which of several picked files go on to the crop step (#338). Invalid
 * files are skipped with a reason, and extras beyond the remaining slots are
 * dropped rather than failing the whole selection.
 */
export function selectPetPhotos(
  files: ReadonlyArray<File>,
  remainingSlots: number,
  maxPhotos: number
): PetPhotoSelection {
  const notices: string[] = [];
  const valid: File[] = [];

  for (const file of files) {
    const problem = validatePetPhotoFile(file);
    if (problem) {
      notices.push(`Skipped ${file.name}: ${problem}`);
    } else {
      valid.push(file);
    }
  }

  const slots = Math.max(0, remainingSlots);
  const accepted = valid.slice(0, slots);
  const dropped = valid.length - accepted.length;

  if (dropped > 0) {
    notices.push(
      slots === 0
        ? `This pet already has the maximum of ${maxPhotos} photos.`
        : `Only ${slots} more ${slots === 1 ? 'photo fits' : 'photos fit'} (${maxPhotos} max), so the first ${slots} ${slots === 1 ? 'was' : 'were'} used.`
    );
  }

  return { accepted, notices };
}
