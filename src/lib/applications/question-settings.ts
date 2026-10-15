import {
  CATEGORY_LABELS,
  PET_TAG_LABELS,
  QUESTION_CATEGORIES,
  type ApplicationQuestion,
  type PetTag,
  type QuestionCategory,
  type QuestionSpecies,
} from '@/types/applications';

export { CATEGORY_LABELS, PET_TAG_LABELS, QUESTION_CATEGORIES };

export type CategorySwitch = 'locked' | 'shown' | 'hidden';

export function isQuestionShown(
  question: ApplicationQuestion,
  shownIds: ReadonlySet<string>
): boolean {
  return question.is_locked || shownIds.has(question.id);
}

export function hideableQuestions(
  questions: readonly ApplicationQuestion[]
): ApplicationQuestion[] {
  return questions.filter((question) => !question.is_locked);
}

export function questionsInCategory(
  questions: readonly ApplicationQuestion[],
  category: QuestionCategory
): ApplicationQuestion[] {
  return questions.filter((question) => question.category === category);
}

export function categorySwitch(
  questions: readonly ApplicationQuestion[],
  category: QuestionCategory,
  shownIds: ReadonlySet<string>
): CategorySwitch {
  const hideable = hideableQuestions(questionsInCategory(questions, category));
  if (hideable.length === 0) return 'locked';
  return hideable.some((question) => shownIds.has(question.id))
    ? 'shown'
    : 'hidden';
}

export function shownCount(
  questions: readonly ApplicationQuestion[],
  shownIds: ReadonlySet<string>
): { locked: number; extra: number; total: number } {
  let locked = 0;
  let extra = 0;
  for (const question of questions) {
    if (question.is_locked) locked += 1;
    else if (shownIds.has(question.id)) extra += 1;
  }
  return { locked, extra, total: locked + extra };
}

export function categoryCounts(
  questions: readonly ApplicationQuestion[],
  category: QuestionCategory,
  shownIds: ReadonlySet<string>
): { shown: number; total: number; locked: number } {
  const inCategory = questionsInCategory(questions, category);
  const locked = inCategory.filter((question) => question.is_locked).length;
  const shown = inCategory.filter((question) =>
    isQuestionShown(question, shownIds)
  ).length;
  return { shown, total: inCategory.length, locked };
}

/**
 * Hide every extra question in the category and remember which were on,
 * so showing the category again restores them (FR-006 / US-003).
 */
export function hideCategory(
  questions: readonly ApplicationQuestion[],
  category: QuestionCategory,
  shownIds: ReadonlySet<string>
): { shownIds: Set<string>; remembered: string[] } {
  const hideable = hideableQuestions(questionsInCategory(questions, category));
  const remembered = hideable
    .filter((question) => shownIds.has(question.id))
    .map((question) => question.id);
  const next = new Set(shownIds);
  for (const question of hideable) next.delete(question.id);
  return { shownIds: next, remembered };
}

/**
 * Restore the last shown set for this category, or turn on every extra
 * question if it has never been shown.
 */
export function showCategory(
  questions: readonly ApplicationQuestion[],
  category: QuestionCategory,
  shownIds: ReadonlySet<string>,
  remembered: readonly string[] | undefined
): Set<string> {
  const hideable = hideableQuestions(questionsInCategory(questions, category));
  const toShow =
    remembered && remembered.length > 0
      ? remembered
      : hideable.map((question) => question.id);
  const next = new Set(shownIds);
  for (const id of toShow) next.add(id);
  return next;
}

export function toggleQuestion(
  question: ApplicationQuestion,
  shownIds: ReadonlySet<string>
): Set<string> {
  const next = new Set(shownIds);
  if (question.is_locked) return next;
  if (next.has(question.id)) next.delete(question.id);
  else next.add(question.id);
  return next;
}

export function questionsForPreview(
  questions: readonly ApplicationQuestion[],
  shownIds: ReadonlySet<string>,
  species: QuestionSpecies,
  tags: readonly PetTag[]
): ApplicationQuestion[] {
  const tagSet = new Set(tags);
  return questions.filter((question) => {
    if (!isQuestionShown(question, shownIds)) return false;
    if (question.species !== 'any' && question.species !== species) {
      return false;
    }
    if (question.pet_tag && !tagSet.has(question.pet_tag)) return false;
    return true;
  });
}

export function questionTags(question: ApplicationQuestion): string[] {
  const tags: string[] = [];
  if (question.is_locked) tags.push('Locked');
  if (question.species === 'dog') tags.push('Dogs only');
  if (question.species === 'cat') tags.push('Cats only');
  if (question.sensitivity === 'sensitive') tags.push('Sensitive');
  if (question.sensitivity === 'third_party') tags.push('Third-party');
  if (question.pet_tag) tags.push(PET_TAG_LABELS[question.pet_tag]);
  const showIf = question.show_if;
  if (showIf?.question === 'hou.own_rent' && showIf.in?.includes('rent')) {
    tags.push('Renters');
  }
  return tags;
}
