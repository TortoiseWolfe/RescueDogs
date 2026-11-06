import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectedRoute from './ProtectedRoute';

// Override the global tests/setup.ts AuthContext mock with one we can
// reconfigure per-test. Without this, ProtectedRoute always sees the
// hardcoded isAuthenticated:true mock and the auth-gating logic is never
// exercised by tests (the original cause of the recurring auth-race
// regressions in commits 6b4c13a, 2c97e67, 259b38d going undetected).
const mockAuth = {
  user: null as { id: string } | null,
  session: null as { access_token: string } | null,
  isLoading: false,
  isAuthenticated: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => '/protected',
  useSearchParams: () => new URLSearchParams(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.session = null;
    mockAuth.isLoading = false;
    mockAuth.isAuthenticated = false;
    mockPush.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the loading spinner while auth is resolving', () => {
    mockAuth.isLoading = true;
    const { container } = render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );
    expect(container.querySelector('.loading-spinner')).not.toBeNull();
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('renders children when authenticated', () => {
    mockAuth.isAuthenticated = true;
    mockAuth.user = { id: '123' };
    render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('renders the sign-in card when never-authenticated and not loading', () => {
    render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );
    expect(
      screen.getByRole('heading', { name: /authentication required/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('debounces redirect on never-authenticated state by 500ms', () => {
    render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );
    // No router.push fired yet
    expect(mockPush).not.toHaveBeenCalled();
    // Advance 499ms — still no push
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(mockPush).not.toHaveBeenCalled();
    // Cross the 500ms threshold
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/sign-in?returnUrl=')
    );
  });

  it('uses custom redirectTo when provided', () => {
    render(
      <ProtectedRoute redirectTo="/login">
        <div>secret</div>
      </ProtectedRoute>
    );
    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/login?returnUrl=')
    );
  });

  describe('query-string deep links (#366)', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('keeps the query string in the redirect returnUrl', () => {
      window.history.replaceState({}, '', '/protected?id=abc-123');
      render(
        <ProtectedRoute>
          <div>secret</div>
        </ProtectedRoute>
      );
      act(() => {
        vi.advanceTimersByTime(501);
      });
      expect(mockPush).toHaveBeenCalledWith(
        '/sign-in?returnUrl=%2Fprotected%3Fid%3Dabc-123'
      );
    });

    it('carries the same full returnUrl on the Sign In and Sign Up links', () => {
      window.history.replaceState({}, '', '/protected?id=abc-123');
      render(
        <ProtectedRoute>
          <div>secret</div>
        </ProtectedRoute>
      );
      expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
        'href',
        '/sign-in?returnUrl=%2Fprotected%3Fid%3Dabc-123'
      );
      expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
        'href',
        '/sign-up?returnUrl=%2Fprotected%3Fid%3Dabc-123'
      );
    });

    it('leaves returnUrl as the bare path when there is no query string', () => {
      window.history.replaceState({}, '', '/protected');
      render(
        <ProtectedRoute>
          <div>secret</div>
        </ProtectedRoute>
      );
      act(() => {
        vi.advanceTimersByTime(501);
      });
      expect(mockPush).toHaveBeenCalledWith('/sign-in?returnUrl=%2Fprotected');
      expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
        'href',
        '/sign-in?returnUrl=%2Fprotected'
      );
    });
  });
});
