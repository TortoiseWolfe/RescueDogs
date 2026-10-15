import { describe, expect, it } from 'vitest';
import type { ApplicationQuestion } from '@/types/applications';
import {
  fieldsForQuestion,
  formatAnswerForReview,
  hasAnsweredValue,
  matchesShowIf,
  needsReferenceShareConfirm,
  partitionApplicationQuestions,
  questionsForApplication,
  reuseProgressLabel,
} from './application-flow';

function q(
  partial: Partial<ApplicationQuestion> & Pick<ApplicationQuestion, 'id'>
): ApplicationQuestion {
  return {
    category: 'housing',
    sort_order: 1,
    wording: partial.id,
    answer_type: 'text',
    choices: null,
    fields: null,
    follow_up: null,
    show_if: null,
    parent_id: null,
    species: 'any',
    pet_tag: null,
    sensitivity: 'normal',
    is_locked: false,
    is_flaggable: false,
    always_optional: false,
    retired_at: null,
    ...partial,
  };
}

describe('hasAnsweredValue', () => {
  it('rejects empty shapes', () => {
    expect(hasAnsweredValue(null)).toBe(false);
    expect(hasAnsweredValue('')).toBe(false);
    expect(hasAnsweredValue({ rows: [] })).toBe(false);
    expect(hasAnsweredValue({ number: '' })).toBe(false);
  });

  it('accepts populated shapes', () => {
    expect(hasAnsweredValue(false)).toBe(true);
    expect(hasAnsweredValue(0)).toBe(true);
    expect(hasAnsweredValue({ legacy_note: 'two cats' })).toBe(true);
    expect(hasAnsweredValue({ rows: [{ name: 'Miso' }] })).toBe(true);
    expect(hasAnsweredValue({ number: '555-0100' })).toBe(true);
  });
});

describe('partitionApplicationQuestions', () => {
  const bank = [
    q({ id: 'con.full_name', category: 'contact', is_locked: true }),
    q({ id: 'hou.restrictions' }),
    q({ id: 'app.why_this_pet', category: 'application', is_locked: true }),
    q({
      id: 'hou.landlord_allows',
      is_locked: true,
      show_if: { question: 'hou.own_rent', in: ['rent'] },
    }),
  ];

  it('asks only unanswered extras when the locked core is saved', () => {
    const answers = new Map<string, unknown>([
      ['con.full_name', 'Dana'],
      ['hou.own_rent', 'own'],
    ]);
    const part = partitionApplicationQuestions(bank, answers);
    expect(part.answered.map((item) => item.id)).toEqual(['con.full_name']);
    expect(part.unanswered.map((item) => item.id)).toEqual([
      'hou.restrictions',
      'app.why_this_pet',
    ]);
    expect(part.answeredCount).toBe(1);
    expect(reuseProgressLabel(part.answeredCount, part.totalCount)).toBe(
      '1 of 3 already answered'
    );
  });

  it('hides show_if questions that do not match', () => {
    const answers = new Map<string, unknown>([['hou.own_rent', 'own']]);
    const part = partitionApplicationQuestions(bank, answers);
    expect(
      part.unanswered.some((item) => item.id === 'hou.landlord_allows')
    ).toBe(false);
  });

  it('shows show_if questions when the gate matches', () => {
    const answers = new Map<string, unknown>([['hou.own_rent', 'rent']]);
    expect(matchesShowIf(bank[3].show_if, answers)).toBe(true);
    const part = partitionApplicationQuestions(bank, answers);
    expect(
      part.unanswered.some((item) => item.id === 'hou.landlord_allows')
    ).toBe(true);
  });
});

describe('questionsForApplication', () => {
  it('drops child repeat_field rows from the top-level list', () => {
    const bank = [
      q({
        id: 'pet.current',
        category: 'pets',
        answer_type: 'repeat',
        is_locked: true,
        fields: [{ key: 'name' }],
      }),
      q({
        id: 'pet.current.spay_neuter',
        category: 'pets',
        answer_type: 'repeat_field',
        parent_id: 'pet.current',
        fields: [{ key: 'spay_neuter' }],
      }),
    ];
    const shown = questionsForApplication(
      bank,
      new Set(['pet.current.spay_neuter']),
      'any',
      []
    );
    expect(shown.map((item) => item.id)).toEqual(['pet.current']);
    expect(fieldsForQuestion(shown[0], bank)).toEqual([
      { key: 'name' },
      { key: 'spay_neuter' },
    ]);
  });
});

describe('needsReferenceShareConfirm', () => {
  it('requires confirm only when saved refs would be copied', () => {
    const shown = [q({ id: 'ref.personal', category: 'references' })];
    expect(
      needsReferenceShareConfirm(
        shown,
        new Map([['ref.personal', { rows: [{ name: 'Pat' }] }]])
      )
    ).toBe(true);
    expect(needsReferenceShareConfirm(shown, new Map())).toBe(false);
  });
});

describe('formatAnswerForReview', () => {
  it('formats common shapes', () => {
    const question = q({ id: 'x' });
    expect(formatAnswerForReview(question, true)).toBe('Yes');
    expect(formatAnswerForReview(question, { number: '555' })).toBe('555');
    expect(
      formatAnswerForReview(question, {
        street: '1 Main',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      })
    ).toBe('1 Main, Austin, TX, 78701');
  });
});
