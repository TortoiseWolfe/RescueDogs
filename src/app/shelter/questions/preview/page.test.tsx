import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { ApplicationQuestion } from '@/types/applications';

const serviceMocks = vi.hoisted(() => ({
  listApplicationQuestions: vi.fn(),
  listShownQuestionIds: vi.fn(),
}));

vi.mock('@/services/applications', () => ({
  ShelterApplicationService: vi.fn().mockImplementation(() => serviceMocks),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('../../ShelterGate', () => ({
  useShelterMembership: () => ({ shelterId: 'shelter-1', role: 'manager' }),
}));

import { saveQuestionSettingsDraft } from '@/lib/applications/question-settings-draft';
import ShelterQuestionsPreviewPage from './page';

const BANK: ApplicationQuestion[] = [
  {
    id: 'hou.home_type',
    category: 'housing',
    sort_order: 401,
    wording: 'What type of home do you live in?',
    answer_type: 'choice',
    choices: [
      { id: 'house', label: 'House' },
      { id: 'apartment', label: 'Apartment' },
    ],
    fields: null,
    follow_up: null,
    show_if: null,
    parent_id: null,
    species: 'any',
    pet_tag: null,
    sensitivity: 'normal',
    is_locked: true,
    is_flaggable: true,
    always_optional: false,
    retired_at: null,
  },
  {
    id: 'hou.insurance_breed',
    category: 'housing',
    sort_order: 410,
    wording: 'Does your insurance restrict dog breeds?',
    answer_type: 'yes_no',
    choices: null,
    fields: null,
    follow_up: null,
    show_if: null,
    parent_id: null,
    species: 'dog',
    pet_tag: null,
    sensitivity: 'normal',
    is_locked: false,
    is_flaggable: true,
    always_optional: false,
    retired_at: null,
  },
];

describe('shelter questions preview page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    serviceMocks.listApplicationQuestions.mockResolvedValue(BANK);
    serviceMocks.listShownQuestionIds.mockResolvedValue([
      'hou.insurance_breed',
    ]);
  });

  it('shows a read-only preview, then hides dog-only questions for a cat', async () => {
    render(<ShelterQuestionsPreviewPage />);

    expect(
      await screen.findByText(/Preview: this is exactly what adopters will see/)
    ).toBeInTheDocument();
    expect(
      screen.getByText('What type of home do you live in?')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Does your insurance restrict dog breeds?')
    ).toBeInTheDocument();
    expect(screen.getByText('2 questions for a dog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cat' }));

    expect(
      screen.queryByText('Does your insurance restrict dog breeds?')
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 question for a cat')).toBeInTheDocument();
  });

  it('overlays an unsaved draft so Preview matches the editor (#476)', async () => {
    serviceMocks.listShownQuestionIds.mockResolvedValue([]);
    saveQuestionSettingsDraft('shelter-1', {
      shownIds: ['hou.insurance_breed'],
      remembered: {},
    });
    render(<ShelterQuestionsPreviewPage />);

    expect(
      await screen.findByText(/Previewing unsaved changes/)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Does your insurance restrict dog breeds?')
    ).toBeInTheDocument();
  });
});
