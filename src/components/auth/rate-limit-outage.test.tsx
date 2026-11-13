import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignInForm from './SignInForm/SignInForm';
import SignUpForm from './SignUpForm/SignUpForm';
import ForgotPasswordForm from './ForgotPasswordForm/ForgotPasswordForm';

// #395: when the rate-limit check itself is down, `checkRateLimit` fails
// closed (the attempt is blocked) with no `locked_until`. The forms must say
// "try again shortly", never "your account is locked for 15 minutes", and a
// real lockout (which carries `locked_until`) must keep its lockout copy.

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@/lib/auth/rate-limit-check', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/auth/rate-limit-check')>();
  return {
    ...actual,
    checkRateLimit: mocks.checkRateLimit,
    recordFailedAttempt: vi.fn(),
  };
});
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    user: null,
  }),
}));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
  createClient: () => ({
    auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
  }),
}));
vi.mock('@/config/captcha.config', () => ({
  captchaConfig: { provider: 'turnstile', siteKey: '', enabled: false },
}));

const OUTAGE = {
  allowed: false,
  remaining: 0,
  locked_until: null,
  reason: 'Rate limit check unavailable. Please try again shortly.',
};

function lockout() {
  return {
    allowed: false,
    remaining: 0,
    locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

const EMAIL = 'user@example.com';

function typeIn(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(container: HTMLElement) {
  fireEvent.submit(container.querySelector('form') as HTMLFormElement);
}

const forms = [
  {
    name: 'SignInForm',
    renderForm: () => {
      const view = render(<SignInForm />);
      typeIn(/email/i, EMAIL);
      typeIn(/^password$/i, 'Password123!');
      return view;
    },
    lockoutCopy: /Your account has been temporarily locked/i,
    authCall: () => mocks.signIn,
  },
  {
    name: 'SignUpForm',
    renderForm: () => {
      const view = render(<SignUpForm />);
      typeIn(/email/i, EMAIL);
      typeIn(/^password$/i, 'Password123!');
      typeIn(/confirm password/i, 'Password123!');
      return view;
    },
    lockoutCopy: /Too many sign-up attempts/i,
    authCall: () => mocks.signUp,
  },
  {
    name: 'ForgotPasswordForm',
    renderForm: () => {
      const view = render(<ForgotPasswordForm />);
      typeIn(/email/i, EMAIL);
      return view;
    },
    lockoutCopy: /Too many password reset attempts/i,
    authCall: () => mocks.resetPasswordForEmail,
  },
];

describe.each(forms)('$name when the rate limiter is down (#395)', (form) => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
    mocks.signIn.mockReset();
    mocks.signUp.mockReset();
    mocks.resetPasswordForEmail.mockReset();
  });

  it('says to try again shortly and does not claim a lockout', async () => {
    mocks.checkRateLimit.mockResolvedValue(OUTAGE);
    const { container } = form.renderForm();
    submit(container);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/try again shortly/i);
    expect(alert).not.toHaveTextContent(/locked/i);
    expect(alert).not.toHaveTextContent(/15 minutes/i);
  });

  it('still blocks the attempt (fail-closed)', async () => {
    mocks.checkRateLimit.mockResolvedValue(OUTAGE);
    const { container } = form.renderForm();
    submit(container);

    await screen.findByRole('alert');
    expect(form.authCall()).not.toHaveBeenCalled();
  });

  it('keeps the lockout copy for a real lockout', async () => {
    mocks.checkRateLimit.mockResolvedValue(lockout());
    const { container } = form.renderForm();
    submit(container);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(form.lockoutCopy);
    expect(alert).toHaveTextContent(/10 minutes/i);
    expect(form.authCall()).not.toHaveBeenCalled();
  });
});
