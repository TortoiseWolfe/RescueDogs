import { describe, expect, it } from 'vitest';
import type { ApplicationQuestion } from '@/types/applications';
import {
  categoryCounts,
  categorySwitch,
  hideCategory,
  isQuestionShown,
  questionTags,
  questionsForPreview,
  showCategory,
  shownCount,
  toggleQuestion,
} from './question-settings';

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

const bank: ApplicationQuestion[] = [
  q({ id: 'hou.home_type', is_locked: true }),
  q({ id: 'hou.own_rent', is_locked: true }),
  q({ id: 'hou.restrictions' }),
  q({ id: 'hou.insurance_breed', species: 'dog' }),
  q({
    id: 'elg.date_of_birth',
    category: 'eligibility',
    sensitivity: 'sensitive',
  }),
  q({
    id: 'spc.senior_pace',
    category: 'pet_specific',
    pet_tag: 'senior',
  }),
];

describe('question-settings', () => {
  it('treats locked questions as shown even when they are not in the set', () => {
    expect(isQuestionShown(bank[0], new Set())).toBe(true);
    expect(isQuestionShown(bank[2], new Set())).toBe(false);
    expect(isQuestionShown(bank[2], new Set(['hou.restrictions']))).toBe(true);
  });

  it('counts locked plus extras for the running total', () => {
    expect(shownCount(bank, new Set(['hou.restrictions']))).toEqual({
      locked: 2,
      extra: 1,
      total: 3,
    });
  });

  it('hides a category and restores the same extras when shown again', () => {
    const shown = new Set(['hou.restrictions', 'hou.insurance_breed']);
    const { shownIds, remembered } = hideCategory(bank, 'housing', shown);
    expect([...shownIds]).toEqual([]);
    expect(categorySwitch(bank, 'housing', shownIds)).toBe('hidden');
    expect(categoryCounts(bank, 'housing', shownIds)).toEqual({
      shown: 2,
      total: 4,
      locked: 2,
    });

    const restored = showCategory(bank, 'housing', shownIds, remembered);
    expect(restored.has('hou.restrictions')).toBe(true);
    expect(restored.has('hou.insurance_breed')).toBe(true);
    expect(restored.has('hou.home_type')).toBe(false);
  });

  it('showing a never-opened category turns on every extra question', () => {
    const next = showCategory(bank, 'eligibility', new Set(), undefined);
    expect([...next]).toEqual(['elg.date_of_birth']);
  });

  it('cannot toggle a locked question off', () => {
    const next = toggleQuestion(bank[0], new Set());
    expect(next.size).toBe(0);
  });

  it('filters preview by shown extras, species, and pet tags', () => {
    const shown = new Set([
      'hou.restrictions',
      'hou.insurance_breed',
      'spc.senior_pace',
    ]);
    const dog = questionsForPreview(bank, shown, 'dog', []).map(
      (row) => row.id
    );
    expect(dog).toEqual([
      'hou.home_type',
      'hou.own_rent',
      'hou.restrictions',
      'hou.insurance_breed',
    ]);

    const seniorDog = questionsForPreview(bank, shown, 'dog', ['senior']).map(
      (row) => row.id
    );
    expect(seniorDog).toContain('spc.senior_pace');

    const cat = questionsForPreview(bank, shown, 'cat', ['senior']).map(
      (row) => row.id
    );
    expect(cat).not.toContain('hou.insurance_breed');
    expect(cat).toContain('spc.senior_pace');
  });

  it('labels locked, species, sensitivity, and renter follow-ups', () => {
    expect(questionTags(bank[0])).toEqual(['Locked']);
    expect(questionTags(bank[3])).toEqual(['Dogs only']);
    expect(questionTags(bank[4])).toEqual(['Sensitive']);
    expect(
      questionTags(
        q({
          id: 'hou.landlord_allows',
          is_locked: true,
          show_if: { question: 'hou.own_rent', in: ['rent'] },
        })
      )
    ).toEqual(['Locked', 'Renters']);
  });
});
