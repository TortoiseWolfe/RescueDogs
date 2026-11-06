import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

const petService = vi.hoisted(() => ({
  createPet: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/services/applications', () => ({
  ShelterPetService: vi.fn().mockImplementation(() => petService),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('../../ShelterGate', () => ({
  useShelterMembership: () => ({
    shelterId: 'shelter-1',
    transports: [],
    transportStates: [],
  }),
}));
vi.mock('@/hooks/useFormDraft', () => ({
  useFormDraft: () => ({
    restored: null,
    savedAt: null,
    clearDraft: vi.fn(),
  }),
}));
vi.mock('@/lib/pet-photos/staged-draft', () => ({
  clearStagedPhotos: vi.fn().mockResolvedValue(undefined),
}));
// Heavy children that are not under test here.
vi.mock('../PetTagsField', () => ({ PetTagsField: () => null }));
vi.mock('../PetAgeFields', () => ({ PetAgeFields: () => null }));
vi.mock('../PetTransportField', () => ({ PetTransportField: () => null }));
vi.mock('../DraftNotice', () => ({ DraftNotice: () => null }));
vi.mock('../PetPhotoManager', () => ({
  PetPhotoManager: React.forwardRef(function PetPhotoManagerStub(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      hasStagedPhotos: () => false,
      uploadStaged: vi.fn(),
    }));
    return null;
  }),
}));

import NewShelterPetPage from './page';

describe('Add Pet page: Save Pet button (#466)', () => {
  beforeEach(() => {
    petService.createPet.mockReset();
  });

  it('keeps its 44px touch-target class and a clean class list while saving', async () => {
    // Never resolves, so the page stays in the saving state.
    petService.createPet.mockReturnValue(new Promise(() => {}));
    render(<NewShelterPetPage />);

    const idle = screen.getByRole('button', { name: 'Save Pet' });
    expect(idle.className).toBe('btn btn-primary min-h-11');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Biscuit' },
    });
    await act(async () => {
      fireEvent.submit(idle.closest('form') as HTMLFormElement);
    });

    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    expect(saving.classList.contains('min-h-11')).toBe(true);
    expect(saving.className).not.toMatch(/min-h-11loading/);
    // The disabled button and its label already show the busy state; a bare
    // spinner class on the button itself would hide the label.
    expect(saving.classList.contains('loading')).toBe(false);
  });
});
