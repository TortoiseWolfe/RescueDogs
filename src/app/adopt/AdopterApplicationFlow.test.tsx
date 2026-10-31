import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ApplicationQuestion, AvailablePet } from '@/types/applications';
import { AdopterApplicationFlow } from './AdopterApplicationFlow';

// Drafts for this form are sensitive, so they go to sessionStorage whatever the
// consent says. The mock only keeps the consent lookup out of the way.
vi.mock('@/utils/consent', () => ({
  canUseCookies: vi.fn(() => false),
}));

const DRAFT_KEY = 'adopt:application:user-1';
const STORAGE_KEY = `draft:v1:${DRAFT_KEY}`;

const nameQuestion: ApplicationQuestion = {
  id: 'con.full_name',
  category: 'contact',
  sort_order: 101,
  wording: 'Full name',
  answer_type: 'text',
  choices: null,
  fields: null,
  follow_up: null,
  show_if: null,
  parent_id: null,
  species: 'any',
  pet_tag: null,
  sensitivity: 'normal',
  is_locked: true,
  is_flaggable: false,
  always_optional: false,
  retired_at: null,
};

const adultsQuestion: ApplicationQuestion = {
  ...nameQuestion,
  id: 'hh.adults_count',
  category: 'household',
  sort_order: 401,
  wording: 'How many adults live in your home?',
  answer_type: 'number',
};

const pets = [
  { id: 'pet-1', shelter_id: 'shelter-1', name: 'Biscuit', species: 'dog' },
  { id: 'pet-2', shelter_id: 'shelter-1', name: 'Mochi', species: 'dog' },
] as unknown as AvailablePet[];

function renderFlow(
  extra: Partial<ComponentProps<typeof AdopterApplicationFlow>> = {}
) {
  return render(
    <AdopterApplicationFlow
      pets={pets}
      preselectedPetId="pet-1"
      savedAnswers={new Map()}
      bank={[nameQuestion]}
      shownByShelter={new Map([['shelter-1', ['con.full_name']]])}
      fallbackName="Dana"
      draftKey={DRAFT_KEY}
      onSubmit={vi.fn()}
      {...extra}
    />
  );
}

describe('AdopterApplicationFlow draft', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('saves typed answers to sessionStorage and restores them after a remount', async () => {
    const first = renderFlow();
    fireEvent.change(screen.getByLabelText(/Full name/), {
      target: { value: 'Dana Adopter' },
    });
    await waitFor(
      () => expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull(),
      { timeout: 3000 }
    );
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) as string);
    expect(stored.data.answers['con.full_name']).toBe('Dana Adopter');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    first.unmount();

    renderFlow();
    await waitFor(() =>
      expect(screen.getByTestId('draft-notice')).toHaveTextContent('Restored')
    );
  });

  it('lets a ?pet= link win over the pet saved in the draft', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        data: {
          petId: 'pet-1',
          answers: { 'con.full_name': 'Dana Adopter' },
          shareReferences: true,
        },
      })
    );
    const onPetIdChange = vi.fn();
    renderFlow({ preselectedPetId: 'pet-2', onPetIdChange });
    await waitFor(() =>
      expect(screen.getByTestId('draft-notice')).toBeTruthy()
    );
    expect(onPetIdChange).toHaveBeenCalledWith('pet-2');
    expect(onPetIdChange).not.toHaveBeenCalledWith('pet-1');
  });

  it('removes the stored draft when the adopter discards it', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        data: {
          petId: 'pet-1',
          answers: { 'con.full_name': 'Dana Adopter' },
          shareReferences: true,
        },
      })
    );
    renderFlow();
    const discard = await screen.findByRole('button', {
      name: 'Discard draft',
    });
    fireEvent.click(discard);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId('draft-notice')).toBeNull();
  });

  it('stores nothing and shows no notice without a draft key', async () => {
    renderFlow({ draftKey: null });
    fireEvent.change(screen.getByLabelText(/Full name/), {
      target: { value: 'Dana Adopter' },
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(sessionStorage.length).toBe(0);
    expect(screen.queryByTestId('draft-notice')).toBeNull();
  });

  it('prefills saved answers on the questions step so they can be edited (#509)', () => {
    renderFlow({
      savedAnswers: new Map([['con.full_name', 'Dana Saved']]),
    });
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Dana Saved');
  });

  it('shows a profile-limit message on a saved one-character name (#460)', () => {
    renderFlow({
      savedAnswers: new Map([['con.full_name', 'D']]),
    });
    expect(screen.getByLabelText(/Full name/)).toHaveValue('D');
    expect(
      screen.getByText('Enter a name between 2 and 100 characters')
    ).toBeTruthy();
  });

  it('blocks Review when a saved household count is outside the table limit (#460)', () => {
    renderFlow({
      bank: [nameQuestion, adultsQuestion],
      shownByShelter: new Map([
        ['shelter-1', ['con.full_name', 'hh.adults_count']],
      ]),
      savedAnswers: new Map<string, unknown>([
        ['con.full_name', 'Dana Adopter'],
        ['hh.adults_count', 25],
      ]),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review application' }));
    expect(screen.getByText('Enter a whole number from 1 to 20')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'New answers' })).toBeNull();
  });
});
