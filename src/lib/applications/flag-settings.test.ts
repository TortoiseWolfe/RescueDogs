import { describe, expect, it } from 'vitest';
import type { ApplicationQuestion } from '@/types/applications';
import type {
  AnswerSnapshotEntry,
  ShelterFlagRule,
} from '@/types/applications';
import {
  defaultFlagLabel,
  emptyFlagDraft,
  flagKind,
  flagSummary,
  isFlagRuleValid,
  ruleMatchesSnapshot,
  toggleFlagAnswer,
  triggeredFlagLabels,
} from './flag-settings';

function q(
  partial: Partial<ApplicationQuestion> & Pick<ApplicationQuestion, 'id'>
): ApplicationQuestion {
  return {
    category: 'housing',
    sort_order: 1,
    wording: partial.id,
    answer_type: 'yes_no',
    choices: null,
    fields: null,
    follow_up: null,
    show_if: null,
    parent_id: null,
    species: 'any',
    pet_tag: null,
    sensitivity: 'normal',
    is_locked: false,
    is_flaggable: true,
    always_optional: false,
    retired_at: null,
    ...partial,
  };
}

describe('flag-settings', () => {
  it('offers no editor for free-text or non-flaggable questions', () => {
    expect(flagKind(q({ id: 'hh.visitors', answer_type: 'long_text' }))).toBe(
      null
    );
    expect(flagKind(q({ id: 'hou.restrictions', is_flaggable: false }))).toBe(
      null
    );
  });

  it('drafts landlord "No" and "Not asked yet" with the staff label', () => {
    const draft = emptyFlagDraft(
      q({
        id: 'hou.landlord_allows',
        answer_type: 'choice',
        choices: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'not_asked', label: 'Not asked yet' },
        ],
      })
    );
    expect(draft.answers).toEqual(['no', 'not_asked']);
    expect(draft.label).toBe("Landlord hasn't approved");
    expect(flagSummary(draft)).toBe('no, not_asked');
  });

  it('drafts hours-alone as more than 8 hours', () => {
    const draft = emptyFlagDraft(
      q({ id: 'lif.hours_alone', answer_type: 'number' })
    );
    expect(draft.comparator).toBe('gt');
    expect(draft.threshold).toBe(8);
    expect(draft.label).toBe('Alone more than 8 hours');
    expect(defaultFlagLabel(q({ id: 'lif.hours_alone' }), 10)).toBe(
      'Alone more than 10 hours'
    );
  });

  it('rejects a choice flag with no answers and accepts a toggle', () => {
    const question = q({
      id: 'hou.restrictions',
      answer_type: 'yes_no',
    });
    const draft = emptyFlagDraft(question);
    expect(isFlagRuleValid(question, { ...draft, answers: [] })).toBe(false);
    expect(
      isFlagRuleValid(question, {
        ...draft,
        answers: toggleFlagAnswer([], 'no'),
      })
    ).toBe(true);
  });
});

function entry(question_id: string, value: unknown): AnswerSnapshotEntry {
  return {
    question_id,
    category: 'eligibility',
    wording: question_id,
    answer_type: 'text',
    choices: null,
    fields: null,
    value,
  };
}

function rule(
  partial: Partial<ShelterFlagRule> &
    Pick<ShelterFlagRule, 'question_id' | 'label'>
): ShelterFlagRule {
  return {
    answers: [],
    comparator: 'in',
    threshold: null,
    ...partial,
  };
}

describe('ruleMatchesSnapshot', () => {
  it('never fires when the question is missing from the snapshot', () => {
    expect(
      ruleMatchesSnapshot(
        rule({
          question_id: 'elg.date_of_birth',
          label: 'Under 21',
          comparator: 'age_lt',
          threshold: 21,
        }),
        [entry('hou.own_rent', 'rent')]
      )
    ).toBe(false);
  });

  it('flags an age below the rescue minimum', () => {
    const nineteen = `${new Date().getUTCFullYear() - 19}-06-01`;
    expect(
      ruleMatchesSnapshot(
        rule({
          question_id: 'elg.date_of_birth',
          label: 'Under 21',
          comparator: 'age_lt',
          threshold: 21,
        }),
        [entry('elg.date_of_birth', nineteen)]
      )
    ).toBe(true);
  });

  it('treats boolean yes/no as choice values', () => {
    const gaveUp = rule({
      question_id: 'pet.ever_given_up',
      label: 'Gave up a pet before',
      answers: ['yes'],
    });
    expect(
      ruleMatchesSnapshot(gaveUp, [entry('pet.ever_given_up', true)])
    ).toBe(true);
    expect(
      ruleMatchesSnapshot(gaveUp, [entry('pet.ever_given_up', false)])
    ).toBe(false);
  });

  it('flags hours-alone above the threshold', () => {
    expect(
      ruleMatchesSnapshot(
        rule({
          question_id: 'lif.hours_alone',
          label: 'Alone more than 8 hours',
          comparator: 'gt',
          threshold: 8,
        }),
        [entry('lif.hours_alone', 10)]
      )
    ).toBe(true);
  });

  it('flags fewer references than the rescue minimum, including empty rows', () => {
    const noRefs = rule({
      question_id: 'ref.personal',
      label: 'No references',
      comparator: 'lt',
      threshold: 1,
    });
    expect(
      ruleMatchesSnapshot(noRefs, [entry('ref.personal', { rows: [] })])
    ).toBe(true);
    expect(
      ruleMatchesSnapshot(noRefs, [
        entry('ref.personal', { rows: [{ name: 'Pat' }] }),
      ])
    ).toBe(false);
  });
});

describe('triggeredFlagLabels', () => {
  it('returns unique staff labels for firing rules only', () => {
    const labels = triggeredFlagLabels(
      [
        rule({
          question_id: 'elg.date_of_birth',
          label: 'Under 21',
          comparator: 'age_lt',
          threshold: 21,
        }),
        rule({
          question_id: 'hou.landlord_allows',
          label: "Landlord hasn't approved",
          answers: ['no', 'not_asked'],
        }),
      ],
      [
        entry('elg.date_of_birth', `${new Date().getUTCFullYear() - 19}-06-01`),
        entry('hou.landlord_allows', 'yes'),
      ]
    );
    expect(labels).toEqual(['Under 21']);
  });
});
