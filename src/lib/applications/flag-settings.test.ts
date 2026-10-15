import { describe, expect, it } from 'vitest';
import type { ApplicationQuestion } from '@/types/applications';
import {
  defaultFlagLabel,
  emptyFlagDraft,
  flagKind,
  flagSummary,
  isFlagRuleValid,
  toggleFlagAnswer,
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
