import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessagingGate from './MessagingGate';

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
  captchaConfig: {
    provider: 'turnstile',
    siteKey: 'test-site-key',
    enabled: true,
  },
}));

vi.mock('@/config/captcha.config', () => ({
  captchaConfig: mocks.captchaConfig,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resend: mocks.resend } }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'user@example.com', email_confirmed_at: null },
    isLoading: false,
  }),
}));
vi.mock('@/lib/auth/oauth-utils', () => ({ isOAuthUser: () => false }));
// Stand-in for the Turnstile widget: a button that hands the gate a token.
vi.mock('@/components/auth/CaptchaWidget', () => ({
  default: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button type="button" onClick={() => onToken('tok-abc')}>
      solve
    </button>
  ),
}));

const resendButton = () =>
  screen.getByRole('button', { name: /resend verification/i });

describe('MessagingGate bot check (Turnstile)', () => {
  beforeEach(() => {
    mocks.resend.mockReset();
    mocks.resend.mockResolvedValue({ error: null });
    mocks.captchaConfig.enabled = true;
  });

  it('does not call Supabase until the bot check is solved', async () => {
    render(
      <MessagingGate>
        <div>Protected</div>
      </MessagingGate>
    );
    fireEvent.click(resendButton());

    expect(await screen.findByText(/bot check/i)).toBeInTheDocument();
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it('sends the Turnstile token with the resend request', async () => {
    render(
      <MessagingGate>
        <div>Protected</div>
      </MessagingGate>
    );
    fireEvent.click(screen.getByRole('button', { name: 'solve' }));
    fireEvent.click(resendButton());

    await waitFor(() =>
      expect(mocks.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com',
        options: { captchaToken: 'tok-abc' },
      })
    );
  });

  it('sends no token and needs no solve when captcha is off', async () => {
    mocks.captchaConfig.enabled = false;
    render(
      <MessagingGate>
        <div>Protected</div>
      </MessagingGate>
    );
    fireEvent.click(resendButton());

    await waitFor(() =>
      expect(mocks.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com',
      })
    );
  });
});
