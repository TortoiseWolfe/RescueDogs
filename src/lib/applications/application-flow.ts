import type {
  ApplicationQuestion,
  PetTag,
  QuestionSpecies,
} from '@/types/applications';
import { questionsForPreview } from './question-settings';

/** Per-application questions — answered fresh every time, never reused. */
export function isNeverReused(question: ApplicationQuestion): boolean {
  return question.category === 'application';
}

/**
 * Questions this rescue shows for this pet (species + tags), top-level only.
 * Child `repeat_field` rows are merged into the parent via {@link fieldsForQuestion}.
 */
export function questionsForApplication(
  questions: readonly ApplicationQuestion[],
  shownIds: ReadonlySet<string>,
  species: QuestionSpecies,
  tags: readonly PetTag[]
): ApplicationQuestion[] {
  return questionsForPreview(questions, shownIds, species, tags).filter(
    (question) => question.parent_id === null
  );
}

/** Field defs for a question, including shown child repeat_field extras. */
export function fieldsForQuestion(
  question: ApplicationQuestion,
  visibleBank: readonly ApplicationQuestion[]
): unknown[] {
  const base = Array.isArray(question.fields) ? [...question.fields] : [];
  if (question.answer_type !== 'repeat') return base;

  const extras = visibleBank
    .filter((child) => child.parent_id === question.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((child) => (Array.isArray(child.fields) ? child.fields : []));

  return [...base, ...extras];
}

export function hasAnsweredValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('legacy_note' in record && hasAnsweredValue(record.legacy_note)) {
      return true;
    }
    if ('rows' in record) {
      return Array.isArray(record.rows) && record.rows.length > 0;
    }
    if ('number' in record) return hasAnsweredValue(record.number);
    if ('level' in record || 'describe' in record) {
      return (
        hasAnsweredValue(record.level) || hasAnsweredValue(record.describe)
      );
    }
    return Object.values(record).some((entry) => hasAnsweredValue(entry));
  }
  return false;
}

type ShowIf = {
  question?: string;
  in?: unknown[];
  gt?: number;
};

export function matchesShowIf(
  showIf: ShowIf | null | undefined,
  answers: ReadonlyMap<string, unknown>
): boolean {
  if (!showIf?.question) return true;
  const raw = answers.get(showIf.question);
  if (showIf.gt !== undefined) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) && n > showIf.gt;
  }
  if (Array.isArray(showIf.in)) {
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      return showIf.in.includes((raw as { value: unknown }).value);
    }
    return showIf.in.includes(raw);
  }
  return true;
}

export interface ApplicationPartition {
  /** Shown questions that already have a reusable saved answer. */
  answered: ApplicationQuestion[];
  /** Shown questions the adopter still needs to fill (includes never-reuse). */
  unanswered: ApplicationQuestion[];
  /** Count used in "X of Y already answered" (excludes never-reuse). */
  answeredCount: number;
  /** Total shown top-level questions (includes never-reuse). */
  totalCount: number;
}

/**
 * Split the rescue's shown questions into reused vs still-needed.
 * `saved` decides what is already on file. `live` (saved answers merged with
 * the in-progress draft) only decides which show_if questions are visible, so
 * typing into a question never moves it out of the ask list.
 */
export function partitionApplicationQuestions(
  shown: readonly ApplicationQuestion[],
  saved: ReadonlyMap<string, unknown>,
  live: ReadonlyMap<string, unknown> = saved
): ApplicationPartition {
  const visible = shown.filter((question) =>
    matchesShowIf(question.show_if, live)
  );

  const answered: ApplicationQuestion[] = [];
  const unanswered: ApplicationQuestion[] = [];

  for (const question of visible) {
    if (isNeverReused(question)) {
      unanswered.push(question);
      continue;
    }
    if (hasAnsweredValue(saved.get(question.id))) {
      answered.push(question);
    } else {
      unanswered.push(question);
    }
  }

  return {
    answered,
    unanswered,
    answeredCount: answered.length,
    totalCount: visible.length,
  };
}

/** Banner copy, or null when nothing is reused yet. */
export function reuseProgressLabel(
  answeredCount: number,
  totalCount: number
): string | null {
  if (answeredCount <= 0 || totalCount <= 0) return null;
  return `${answeredCount} of ${totalCount} already answered`;
}

export const REFERENCE_QUESTION_ID = 'ref.personal';

/** True when saved references would be copied unless the adopter confirms. */
export function needsReferenceShareConfirm(
  shown: readonly ApplicationQuestion[],
  savedAnswers: ReadonlyMap<string, unknown>
): boolean {
  const shownRefs = shown.some(
    (question) => question.id === REFERENCE_QUESTION_ID
  );
  if (!shownRefs) return false;
  return hasAnsweredValue(savedAnswers.get(REFERENCE_QUESTION_ID));
}

export function formatAnswerForReview(
  question: ApplicationQuestion,
  value: unknown
): string {
  if (!hasAnsweredValue(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.legacy_note === 'string' && record.legacy_note.trim()) {
      return record.legacy_note;
    }
    if (Array.isArray(record.rows)) {
      return `${record.rows.length} entr${record.rows.length === 1 ? 'y' : 'ies'}`;
    }
    if (
      typeof record.number === 'string' ||
      typeof record.number === 'number'
    ) {
      return String(record.number);
    }
    if (record.street || record.city) {
      return [record.street, record.unit, record.city, record.state, record.zip]
        .filter((part) => hasAnsweredValue(part))
        .map(String)
        .join(', ');
    }
    if (record.name || record.phone) {
      return [record.name, record.phone]
        .filter((part) => hasAnsweredValue(part))
        .map(String)
        .join(' · ');
    }
    if (record.level || record.describe) {
      return [record.level, record.describe]
        .filter((part) => hasAnsweredValue(part))
        .map(String)
        .join(' — ');
    }
    if ('value' in record) {
      const detail = record.detail ?? record.describe ?? record.follow_up;
      return detail && hasAnsweredValue(detail)
        ? `${String(record.value)} — ${String(detail)}`
        : String(record.value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return '—';
}
