import type { PetSex, PetStatus } from '@/types/applications';

type Pronouns = {
  object: string;
  contracted: string;
};

function petPronouns(sex: PetSex | null | undefined): Pronouns {
  if (sex === 'male' || sex === 'neutered_male') {
    return { object: 'him', contracted: "He's" };
  }
  if (sex === 'female' || sex === 'neutered_female') {
    return { object: 'her', contracted: "She's" };
  }
  return { object: 'them', contracted: "They're" };
}

/**
 * Confirm shown when staff first mark a pet Adopted and open applications
 * will close (#339).
 */
export function adoptedConfirmMessage(input: {
  name: string;
  sex?: PetSex | null;
  openCount: number;
}): string {
  const name = input.name.trim() || 'This pet';
  const { object } = petPronouns(input.sex);
  const apps =
    input.openCount === 1
      ? '1 open application'
      : `${input.openCount} open applications`;
  const who = input.openCount === 1 ? 'that applicant' : 'those applicants';
  return `${name} has ${apps}. Marking ${object} adopted will let ${who} know.`;
}

/**
 * Why a pet with applications cannot be deleted (#339). Adopted pets are
 * archived; others are steered toward Adopted instead of Delete.
 */
export function petArchiveNote(input: {
  name: string;
  sex?: PetSex | null;
  status: PetStatus;
  applicationCount: number;
}): string {
  const name = input.name.trim() || 'This pet';
  const { object, contracted } = petPronouns(input.sex);
  if (input.status === 'adopted') {
    return `${name} is marked Adopted and hidden from browse. ${contracted} kept on file because applicants' records point to ${object}.`;
  }
  const apps =
    input.applicationCount === 1
      ? '1 application'
      : `${input.applicationCount} applications`;
  return `${name} has ${apps}, so it's kept on file. Mark ${name} Adopted to take the listing off the site.`;
}
