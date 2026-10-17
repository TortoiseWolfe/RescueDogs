import type {
  AnswerSnapshotEntry,
  ApplicationQuestion,
  FlagComparator,
  ShelterFlagRule,
} from '@/types/applications';

export type FlagKind = 'choices' | 'number' | 'age' | 'count';

export type FlagChoice = { value: string; label: string };

const YES_NO_CHOICES: FlagChoice[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const DEFAULT_LABELS: Record<string, string> = {
  'elg.date_of_birth': 'Under {n}',
  'elg.cruelty_conviction': 'Conviction',
  'elg.application_rejected': 'Rejected before',
  'hh.children_count': 'Young children',
  'hh.all_agree': 'Household not in agreement',
  'hh.allergies': 'Allergies',
  'hh.pet_for': 'Gift',
  'hou.home_type': 'Apartment / renter',
  'hou.own_rent': 'Apartment / renter',
  'hou.landlord_allows': "Landlord hasn't approved",
  'hou.restrictions': 'Housing restrictions',
  'hou.insurance_breed': 'Housing restrictions',
  'hou.breed_legislation': 'Housing restrictions',
  'yrd.fenced': 'No fenced yard',
  'lif.hours_alone': 'Alone more than {n} hours',
  'lif.budget': 'Budget concern',
  'pet.ever_given_up': 'Gave up a pet before',
  'ref.personal': 'No references',
  'trn.decompression': 'Short decompression',
  'scn.give_up_reasons': 'Would give up for…',
};

export function flagKind(question: ApplicationQuestion): FlagKind | null {
  if (!question.is_flaggable) return null;
  switch (question.answer_type) {
    case 'yes_no':
    case 'choice':
    case 'multi_choice':
      return 'choices';
    case 'number':
      return 'number';
    case 'date':
      return 'age';
    case 'repeat':
      return 'count';
    default:
      return null;
  }
}

export function flagChoices(question: ApplicationQuestion): FlagChoice[] {
  if (question.answer_type === 'yes_no') return YES_NO_CHOICES;
  if (!Array.isArray(question.choices)) return [];
  return question.choices.flatMap((choice) => {
    if (choice && typeof choice === 'object' && 'value' in choice) {
      const value = String((choice as { value: unknown }).value);
      const label =
        'label' in choice
          ? String((choice as { label: unknown }).label)
          : value;
      return [{ value, label }];
    }
    return [];
  });
}

export function defaultFlagThreshold(
  question: ApplicationQuestion
): number | null {
  if (question.id === 'elg.date_of_birth') return 21;
  if (question.id === 'lif.hours_alone') return 8;
  if (question.id === 'hh.children_count') return 0;
  if (question.id === 'ref.personal') return 1;
  const kind = flagKind(question);
  if (kind === 'number' || kind === 'age' || kind === 'count') return 1;
  return null;
}

export function defaultFlagComparator(
  question: ApplicationQuestion
): FlagComparator {
  const kind = flagKind(question);
  if (kind === 'age') return 'age_lt';
  if (kind === 'number') return 'gt';
  if (kind === 'count') return 'lt';
  return 'in';
}

export function defaultFlagLabel(
  question: ApplicationQuestion,
  threshold: number | null
): string {
  const template = DEFAULT_LABELS[question.id] ?? 'Needs a closer look';
  if (threshold === null)
    return template.replace(' {n}', '').replace('{n}', '');
  return template.replaceAll('{n}', String(threshold));
}

export function emptyFlagDraft(question: ApplicationQuestion): ShelterFlagRule {
  const kind = flagKind(question);
  const threshold = defaultFlagThreshold(question);
  const answers =
    kind === 'choices'
      ? flagChoices(question)
          .filter(
            (choice) => choice.value === 'no' || choice.value === 'not_asked'
          )
          .map((choice) => choice.value)
      : [];
  return {
    question_id: question.id,
    answers:
      answers.length > 0
        ? answers
        : kind === 'choices'
          ? flagChoices(question)
              .slice(0, 1)
              .map((choice) => choice.value)
          : [],
    comparator: defaultFlagComparator(question),
    threshold,
    label: defaultFlagLabel(question, threshold),
  };
}

export function toggleFlagAnswer(
  answers: readonly string[],
  value: string
): string[] {
  return answers.includes(value)
    ? answers.filter((item) => item !== value)
    : [...answers, value];
}

export function isFlagRuleValid(
  question: ApplicationQuestion,
  rule: ShelterFlagRule
): boolean {
  const kind = flagKind(question);
  if (!kind) return false;
  const label = rule.label.trim();
  if (label.length < 1 || label.length > 80) return false;
  if (kind === 'choices') return rule.answers.length > 0;
  return rule.threshold !== null && Number.isFinite(rule.threshold);
}

export function flagSummary(rule: ShelterFlagRule): string {
  if (rule.comparator === 'gt') return `More than ${rule.threshold}`;
  if (rule.comparator === 'lt') return `Fewer than ${rule.threshold}`;
  if (rule.comparator === 'age_lt') return `Under ${rule.threshold}`;
  return rule.answers.join(', ');
}

function snapshotValue(
  snapshot: readonly AnswerSnapshotEntry[] | null | undefined,
  questionId: string
): unknown {
  return snapshot?.find((entry) => entry.question_id === questionId)?.value;
}

function choiceValues(value: unknown): string[] {
  if (value === true) return ['yes'];
  if (value === false) return ['no'];
  if (typeof value === 'string' || typeof value === 'number') {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) return choiceValues(record.value);
  }
  return [];
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { rows?: unknown }).rows)
  ) {
    return (value as { rows: unknown[] }).rows.length;
  }
  return null;
}

function ageYears(isoDate: string, asOf = new Date()): number | null {
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const month = asOf.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && asOf.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** True when this rescue's rule fires on the frozen snapshot (never live answers). */
export function ruleMatchesSnapshot(
  rule: ShelterFlagRule,
  snapshot: readonly AnswerSnapshotEntry[] | null | undefined
): boolean {
  if (!snapshot || snapshot.length === 0) return false;
  const present = snapshot.some(
    (entry) => entry.question_id === rule.question_id
  );
  if (!present) return false;

  const value = snapshotValue(snapshot, rule.question_id);

  if (rule.comparator === 'in') {
    const got = choiceValues(value);
    return rule.answers.some((answer) => got.includes(answer));
  }

  if (rule.comparator === 'age_lt') {
    if (rule.threshold === null || typeof value !== 'string') return false;
    const age = ageYears(value);
    return age !== null && age < rule.threshold;
  }

  const amount =
    value === null || value === undefined ? 0 : numericValue(value);
  if (amount === null || rule.threshold === null) return false;
  if (rule.comparator === 'gt') return amount > rule.threshold;
  if (rule.comparator === 'lt') return amount < rule.threshold;
  return false;
}

/** Staff-facing labels for flags that fire on this application. */
export function triggeredFlagLabels(
  rules: readonly ShelterFlagRule[],
  snapshot: readonly AnswerSnapshotEntry[] | null | undefined
): string[] {
  const labels: string[] = [];
  for (const rule of rules) {
    if (!ruleMatchesSnapshot(rule, snapshot)) continue;
    const label = rule.label.trim();
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
