import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmailVerificationNotice from './EmailVerificationNotice';

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
  }),
}));
// Stand-in for the Turnstile widget: a button that hands the form a token.
vi.mock('@/components/auth/CaptchaWidget', () => ({
  default: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button type="button" onClick={() => onToken('tok-abc')}>
      solve
    </button>
  ),
}));

describe('EmailVerificationNotice bot check (Turnstile)', () => {
  beforeEach(() => {
    mocks.resend.mockReset();
    mocks.resend.mockResolvedValue({ error: null });
    mocks.captchaConfig.enabled = true;
  });

  it('does not call Supabase until the bot check is solved', async () => {
    render(<EmailVerificationNotice />);
    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    expect(await screen.findByText(/bot check/i)).toBeInTheDocument();
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it('sends the Turnstile token with the resend request', async () => {
    render(<EmailVerificationNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'solve' }));
    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

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
    render(<EmailVerificationNotice />);
    fireEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() =>
      expect(mocks.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com',
      })
    );
  });
});
