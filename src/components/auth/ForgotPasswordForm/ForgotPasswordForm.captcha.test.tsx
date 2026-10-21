import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordForm from './ForgotPasswordForm';

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  recordFailedAttempt: vi.fn(),
  captchaConfig: {
    provider: 'turnstile',
    siteKey: 'test-site-key',
    enabled: true,
  },
}));

vi.mock('@/config/captcha.config', () => ({
  captchaConfig: mocks.captchaConfig,
}));
vi.mock('@/lib/supabase/client', () => {
  const client = {
    auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
  };
  return { createClient: () => client, supabase: client };
});
vi.mock('@/lib/auth/rate-limit-check', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/auth/rate-limit-check')>();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
    recordFailedAttempt: mocks.recordFailedAttempt,
  };
});
vi.mock('@/lib/auth/audit-logger', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));
// Stand-in for the Turnstile widget: a button that hands the form a token.
vi.mock('@/components/auth/CaptchaWidget', () => ({
  default: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button type="button" onClick={() => onToken('tok-abc')}>
      solve
    </button>
  ),
}));

function submitWithEmail(container: HTMLElement) {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'user@example.com' },
  });
  fireEvent.submit(container.querySelector('form') as HTMLFormElement);
}

describe('ForgotPasswordForm bot check (Turnstile)', () => {
  beforeEach(() => {
    mocks.resetPasswordForEmail.mockReset();
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.recordFailedAttempt.mockReset();
    mocks.captchaConfig.enabled = true;
  });

  it('does not call Supabase or count a failed attempt until the bot check is solved', async () => {
    const { container } = render(<ForgotPasswordForm />);
    submitWithEmail(container);

    expect(await screen.findByRole('alert')).toHaveTextContent(/bot check/i);
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('sends the Turnstile token with the reset request', async () => {
    const { container } = render(<ForgotPasswordForm />);
    fireEvent.click(screen.getByRole('button', { name: 'solve' }));
    submitWithEmail(container);

    await waitFor(() =>
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({ captchaToken: 'tok-abc' })
      )
    );
  });

  it('sends no token and needs no solve when captcha is off', async () => {
    mocks.captchaConfig.enabled = false;
    const { container } = render(<ForgotPasswordForm />);
    submitWithEmail(container);

    await waitFor(() => expect(mocks.resetPasswordForEmail).toHaveBeenCalled());
    const options = mocks.resetPasswordForEmail.mock.calls[0][1];
    expect(options).not.toHaveProperty('captchaToken');
  });
});
