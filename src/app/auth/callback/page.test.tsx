/**
 * Auth callback page: the "still no user" redirect timer (#396).
 *
 * The page waits two seconds for a session before sending the visitor to
 * /sign-in?error=auth_callback_failed. That timer used to survive a re-render,
 * so a session that arrived a moment later was followed by a bounce to the
 * error page.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const mockPush = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/auth/oauth-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/auth/oauth-utils')>();
  return {
    ...actual,
    isOAuthUser: () => false,
    populateOAuthProfile: vi.fn().mockResolvedValue(true),
  };
});

import AuthCallbackPage from './page';

const ERROR_URL = '/sign-in?error=auth_callback_failed';
const signedIn = {
  user: { id: 'u1', email: 'a@example.com' },
  isLoading: false,
};
const signedOut = { user: null, isLoading: false };

describe('AuthCallbackPage redirect timer (#396)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPush.mockReset();
    window.history.replaceState({}, '', '/auth/callback');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not bounce to the error page when the session arrives within 2 seconds', async () => {
    mockUseAuth.mockReturnValue(signedOut);
    const { rerender } = render(<AuthCallbackPage />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    mockUseAuth.mockReturnValue(signedIn);
    rerender(<AuthCallbackPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockPush).toHaveBeenCalledWith('/profile');
    expect(mockPush).not.toHaveBeenCalledWith(ERROR_URL);
  });

  it('still redirects to sign-in when no user shows up for 2 seconds', async () => {
    mockUseAuth.mockReturnValue(signedOut);
    render(<AuthCallbackPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001);
    });

    expect(mockPush).toHaveBeenCalledWith(ERROR_URL);
  });

  it('cancels the pending redirect when the page unmounts', async () => {
    mockUseAuth.mockReturnValue(signedOut);
    const { unmount } = render(<AuthCallbackPage />);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not auto-redirect while an error from the link is on screen', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/callback#error=access_denied&error_description=Link+expired'
    );
    mockUseAuth.mockReturnValue(signedOut);
    render(<AuthCallbackPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
