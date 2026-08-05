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

  // Regression guard for #126. AuthContext calls setUser(session?.user ?? null) at
  // four sites (hydration, onAuthStateChange, sign-in, refresh), each producing a NEW
  // user object. Keying the effect on the object re-ran the key bootstrap every time,
  // and each run minted a fresh random device key — so a peer could encrypt to a key
  // that was superseded moments later and never be decryptable.
  it('does not re-bootstrap when the user object changes but the id is the same (#126)', async () => {
    const { rerender } = render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(mockEnsureKeysForSession).toHaveBeenCalledTimes(1);
    });

    // Same user, brand-new object identity — exactly what a token refresh produces.
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isLoading: false,
    });
    rerender(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });
    expect(mockEnsureKeysForSession).toHaveBeenCalledTimes(1);
  });

  it('does bootstrap again when a different user signs in (#60 unbroken)', async () => {
    const { rerender } = render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(mockEnsureKeysForSession).toHaveBeenCalledWith('test-user-id');
    });

    mockUseAuth.mockReturnValue({
      user: { id: 'other-user-id', email: 'other@example.com' },
      isLoading: false,
    });
    rerender(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );

    await waitFor(() => {
      expect(mockEnsureKeysForSession).toHaveBeenCalledWith('other-user-id');
    });
    expect(mockEnsureKeysForSession).toHaveBeenCalledTimes(2);
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
