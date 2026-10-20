import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { ApplicationQuestion } from '@/types/applications';
import {
  questionSettingsDraftKey,
  saveQuestionSettingsDraft,
} from '@/lib/applications/question-settings-draft';

const serviceMocks = vi.hoisted(() => ({
  listApplicationQuestions: vi.fn(),
  listShownQuestionIds: vi.fn(),
  setShownQuestionIds: vi.fn(),
  listApplicationFlags: vi.fn(),
  setApplicationFlag: vi.fn(),
  clearApplicationFlag: vi.fn(),
}));

const membership = vi.hoisted(() => ({
  shelterId: 'shelter-1',
  role: 'manager' as 'manager' | 'staff',
}));

vi.mock('@/services/applications', () => ({
  ShelterApplicationService: vi.fn().mockImplementation(() => serviceMocks),
  QuestionSettingsError: class QuestionSettingsError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('../ShelterGate', () => ({
  useShelterMembership: () => membership,
}));

import ShelterQuestionsPage from './page';

const BANK: ApplicationQuestion[] = [
  {
    id: 'hou.home_type',
    category: 'housing',
    sort_order: 401,
    wording: 'What type of home do you live in?',
    answer_type: 'choice',
    choices: [],
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
    id: 'hou.restrictions',
    category: 'housing',
    sort_order: 405,
    wording: 'Does your landlord, HOA, or neighborhood have pet restrictions?',
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
  },
];

describe('shelter questions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    membership.role = 'manager';
    serviceMocks.listApplicationQuestions.mockResolvedValue(BANK);
    serviceMocks.listShownQuestionIds.mockResolvedValue([]);
    serviceMocks.setShownQuestionIds.mockResolvedValue(1);
    serviceMocks.listApplicationFlags.mockResolvedValue([]);
    serviceMocks.setApplicationFlag.mockResolvedValue(undefined);
    serviceMocks.clearApplicationFlag.mockResolvedValue(undefined);
  });

  it('shows locked questions and lets a manager add an extra, then save', async () => {
    render(<ShelterQuestionsPage />);

    expect(
      await screen.findByRole('heading', { name: 'Application questions' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 locked \+ 0 you chose = 1 question/)
    ).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show Does your landlord, HOA, or neighborhood have pet restrictions?',
      })
    );

    const save = screen.getByRole('button', { name: 'Save changes' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() =>
      expect(serviceMocks.setShownQuestionIds).toHaveBeenCalledWith(
        'shelter-1',
        ['hou.restrictions']
      )
    );
    expect(
      await screen.findByText(/Saved. New applications use these questions/)
    ).toBeInTheDocument();
  });

  it('staff can view but not save', async () => {
    membership.role = 'staff';
    render(<ShelterQuestionsPage />);

    expect(
      await screen.findByText(/Only a manager can change which questions/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('always labels the category as Shown, even when extras are off (#476)', async () => {
    render(<ShelterQuestionsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Application questions' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Shown: 1 of 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Hidden:/)).not.toBeInTheDocument();
  });

  it('restores an unsaved draft from this window (#476)', async () => {
    saveQuestionSettingsDraft('shelter-1', {
      shownIds: ['hou.restrictions'],
      remembered: {},
    });
    render(<ShelterQuestionsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Application questions' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    );
    expect(screen.getByText(/Shown: 2 of 2/)).toBeInTheDocument();
  });

  it('Reset restores the locked core and leaves Save enabled when extras were saved (#476)', async () => {
    serviceMocks.listShownQuestionIds.mockResolvedValue(['hou.restrictions']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ShelterQuestionsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Application questions' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Shown: 2 of 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() =>
      expect(screen.getByText(/Shown: 1 of 2/)).toBeInTheDocument()
    );
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(serviceMocks.setShownQuestionIds).toHaveBeenCalledWith(
        'shelter-1',
        []
      )
    );
    expect(
      sessionStorage.getItem(questionSettingsDraftKey('shelter-1'))
    ).toBeNull();
    confirm.mockRestore();
  });

  it('opens the red-flag editor for a flaggable question', async () => {
    render(<ShelterQuestionsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Application questions' })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Add red flag for Does your landlord, HOA, or neighborhood have pet restrictions?',
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Red flag' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save flag' }));
    await waitFor(() =>
      expect(serviceMocks.setApplicationFlag).toHaveBeenCalled()
    );
  });
});
