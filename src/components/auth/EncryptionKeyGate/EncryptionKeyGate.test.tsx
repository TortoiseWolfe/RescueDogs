import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EncryptionKeyGate from './EncryptionKeyGate';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockEnsureKeysForSession = vi.fn();
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    ensureKeysForSession: (...args: unknown[]) =>
      mockEnsureKeysForSession(...args),
  },
}));

describe('EncryptionKeyGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isLoading: false,
    });
    mockEnsureKeysForSession.mockResolvedValue({
      privateKey: {},
      publicKey: {},
    });
  });

  it('shows loading overlay while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    expect(
      screen.getByTestId('encryption-key-gate-loading')
    ).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('shows loading overlay while ensuring keys', () => {
    mockEnsureKeysForSession.mockReturnValue(new Promise(() => {}));
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    expect(
      screen.getByTestId('encryption-key-gate-loading')
    ).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('bootstraps session keys without setup redirect or re-auth modal', async () => {
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(mockEnsureKeysForSession).toHaveBeenCalledWith('test-user-id');
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId('encryption-key-gate-loading')
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.queryByTestId('reauth-modal-mock')).not.toBeInTheDocument();
  });

  it('shows an error alert when bootstrap fails', async () => {
    mockEnsureKeysForSession.mockRejectedValue(new Error('boom'));
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId('encryption-key-gate-error')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });
});
