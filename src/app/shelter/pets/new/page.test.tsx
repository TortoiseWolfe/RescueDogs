import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/applications', () => ({
  ShelterPetService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('../../ShelterGate', () => ({
  useShelterMembership: () => ({
    shelterId: 'shelter-1',
    transports: false,
    transportStates: [] as string[],
  }),
}));
vi.mock('../PetPhotoManager', () => ({
  PetPhotoManager: React.forwardRef(function PetPhotoManager(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      uploadStaged: async () => {},
      hasStagedPhotos: () => false,
      clearStaged: async () => {},
    }));
    return null;
  }),
}));
vi.mock('../PetTagsField', () => ({
  PetTagsField: ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (next: string[]) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange(['senior_friendly'])}>
        Pick a tag
      </button>
      <span data-testid="tag-count">{value.length}</span>
    </div>
  ),
}));

import NewShelterPetPage from './page';

/** Let the draft hook's debounced write (800 ms) run. */
function waitForAutosave() {
  act(() => {
    vi.advanceTimersByTime(1500);
  });
}

describe('Add Pet draft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Discard draft clears the picked application tags (#467)', () => {
    render(<NewShelterPetPage />);
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Rex' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pick a tag' }));
    waitForAutosave();
    expect(screen.getByTestId('tag-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));

    expect(screen.getByTestId('tag-count')).toHaveTextContent('0');
  });

  it('Discard draft does not write the untouched form back as a draft (#467)', () => {
    render(<NewShelterPetPage />);
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Rex' },
    });
    waitForAutosave();
    expect(screen.getByTestId('draft-notice')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    waitForAutosave();

    expect(screen.queryByTestId('draft-notice')).not.toBeInTheDocument();
  });

  it('still saves a form that differs from the defaults only by species (#467)', () => {
    render(<NewShelterPetPage />);
    fireEvent.change(screen.getByLabelText('Species'), {
      target: { value: 'cat' },
    });
    waitForAutosave();

    expect(screen.getByTestId('draft-notice')).toBeInTheDocument();
  });
});
