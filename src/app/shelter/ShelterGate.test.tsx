import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  listMyShelterMemberships: vi.fn(),
  auth: { user: { id: 'user-1' }, isLoading: false },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/applications', () => ({
  ShelterApplicationService: vi.fn().mockImplementation(() => ({
    listMyShelterMemberships: mocks.listMyShelterMemberships,
  })),
  AlreadyAMemberError: class AlreadyAMemberError extends Error {},
}));

import { ShelterGate } from './ShelterGate';

const MEMBERSHIP = {
  shelterId: '3f2b8c1e-5d4a-4b7e-9c6d-1a2b3c4d5e6f',
  shelterName: 'Test Rescue',
  role: 'manager' as const,
  transports: false,
  transportStates: [] as string[],
};

function Draft() {
  return <input aria-label="draft" />;
}

function gate() {
  return (
    <ShelterGate>
      <Draft />
    </ShelterGate>
  );
}

describe('ShelterGate token refresh', () => {
  beforeEach(() => {
    mocks.listMyShelterMemberships.mockReset();
    mocks.listMyShelterMemberships.mockResolvedValue([MEMBERSHIP]);
    mocks.auth = { user: { id: 'user-1' }, isLoading: false };
  });

  it('keeps children mounted when AuthContext swaps in a new user object', async () => {
    const { rerender } = render(gate());
    const input = await screen.findByLabelText('draft');
    fireEvent.change(input, { target: { value: 'half-typed' } });

    // Same person, new object: what TOKEN_REFRESHED does.
    mocks.auth = { user: { id: 'user-1' }, isLoading: false };
    rerender(gate());

    expect(screen.getByLabelText('draft')).toHaveValue('half-typed');
    expect(mocks.listMyShelterMemberships).toHaveBeenCalledTimes(1);
  });

  it('checks membership again for a different user id', async () => {
    const { rerender } = render(gate());
    await screen.findByLabelText('draft');

    mocks.auth = { user: { id: 'user-2' }, isLoading: false };
    rerender(gate());

    await waitFor(() =>
      expect(mocks.listMyShelterMemberships).toHaveBeenCalledTimes(2)
    );
    expect(mocks.listMyShelterMemberships).toHaveBeenLastCalledWith('user-2');
  });

  it('still shows the error card on a first-load failure and retries from it', async () => {
    mocks.listMyShelterMemberships.mockRejectedValueOnce(new Error('offline'));
    render(gate());

    expect(await screen.findByText('Could not load your rescue')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('draft')).toBeTruthy();
    expect(mocks.listMyShelterMemberships).toHaveBeenCalledTimes(2);
  });
});
