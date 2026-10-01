import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const serviceMocks = vi.hoisted(() => ({
  getApplication: vi.fn(),
  getApplicantEmail: vi.fn(),
  advanceStatus: vi.fn(),
  finalizeAdoption: vi.fn(),
}));

vi.mock('@/services/applications', () => ({
  ShelterApplicationService: vi.fn().mockImplementation(() => serviceMocks),
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/messaging/connection-service', () => ({
  connectionService: { startConversationWithUser: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('id=app-1'),
}));

const advanceOutcome = vi.hoisted(() => ({ rejected: false }));

// Stands in for the pipeline controls: reports whether onAdvance rejected, which
// is how StatusDropdown decides to keep the staff note.
vi.mock('@/components/organisms/ApplicationDetail', () => ({
  default: function ApplicationDetailStub({
    onAdvance,
    onFinalizeAdoption,
  }: {
    onAdvance: (status: string, note?: string) => Promise<void>;
    onFinalizeAdoption: () => Promise<void>;
  }) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            onAdvance('under_review', 'note').catch(() => {
              advanceOutcome.rejected = true;
            });
          }}
        >
          Advance
        </button>
        <button type="button" onClick={() => void onFinalizeAdoption()}>
          Finalize
        </button>
      </>
    );
  },
}));

import ShelterApplicationPage from './page';

const APPLICATION = { id: 'app-1', adopter_id: 'adopter-1' };

describe('shelter application page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    advanceOutcome.rejected = false;
    serviceMocks.getApplicantEmail.mockResolvedValue('a@example.com');
  });

  it('shows the load error with Retry, not "not found", when the load fails (#410)', async () => {
    serviceMocks.getApplication.mockRejectedValue(new Error('network'));
    render(<ShelterApplicationPage />);

    expect(
      await screen.findByText('Could not load this application.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/Application not found/)).not.toBeInTheDocument();
  });

  it('loads the application when Retry succeeds (#410)', async () => {
    serviceMocks.getApplication
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(APPLICATION);
    render(<ShelterApplicationPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('button', { name: 'Advance' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Could not load this application.')
    ).not.toBeInTheDocument();
    expect(serviceMocks.getApplication).toHaveBeenCalledTimes(2);
  });

  it('still says "not found" when the application does not exist', async () => {
    serviceMocks.getApplication.mockResolvedValue(null);
    render(<ShelterApplicationPage />);

    expect(
      await screen.findByText(/Application not found/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument();
  });

  it('shows the error and lets the status control see the failure (#411)', async () => {
    serviceMocks.getApplication.mockResolvedValue(APPLICATION);
    serviceMocks.advanceStatus.mockRejectedValue(new Error('network'));
    render(<ShelterApplicationPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Advance' }));

    expect(
      await screen.findByText(/Could not update the status/)
    ).toBeInTheDocument();
    await waitFor(() => expect(advanceOutcome.rejected).toBe(true));
  });

  it('keeps the mark-adopted error on screen after the refresh', async () => {
    serviceMocks.getApplication.mockResolvedValue(APPLICATION);
    serviceMocks.finalizeAdoption.mockRejectedValue(new Error('network'));
    render(<ShelterApplicationPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize' }));

    expect(
      await screen.findByText('Could not mark this pet adopted. Refreshing.')
    ).toBeInTheDocument();
  });
});
