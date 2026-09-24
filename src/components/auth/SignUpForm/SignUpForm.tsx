'use client';

import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkRateLimit,
  recordFailedAttempt,
  formatLockoutTime,
  isAuthRequestRateLimited,
  AUTH_SIGN_UP_RATE_LIMIT_MESSAGE,
} from '@/lib/auth/rate-limit-check';
import { validateEmail } from '@/lib/auth/email-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import PasswordStrengthIndicator from '@/components/atomic/PasswordStrengthIndicator';
import { PasswordField } from '@/components/atomic/PasswordField';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:auth:SignUpForm');

export interface SignUpFormProps {
  /** Callback on successful sign up */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SignUpForm component
 * Email/password sign-up with server-side rate limiting
 *
 * @category molecular
 */
export default function SignUpForm({
  onSuccess,
  className = '',
}: SignUpFormProps) {
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Enhanced email validation (REQ-SEC-004)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.errors[0] || 'Invalid email address');
      return;
    }

    // Show warning for disposable emails
    if (emailValidation.warnings.length > 0) {
      logger.warn('Email validation warnings', {
        warnings: emailValidation.warnings,
      });
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Confirm password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Check server-side rate limit for sign-up attempts (REQ-SEC-003)
    const rateLimit = await checkRateLimit(email, 'sign_up');

    if (!rateLimit.allowed) {
      const timeUntilReset = rateLimit.locked_until
        ? formatLockoutTime(rateLimit.locked_until)
        : '15 minutes';
      setError(
        `Too many sign-up attempts. Please try again in ${timeUntilReset}.`
      );
      return;
    }

    // Bot check (#231). Rate limit is keyed on email — fresh addresses bypass it.
    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the bot check before signing up.');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp(
      email,
      password,
      captchaToken ?? undefined
    );

    setLoading(false);

    if (signUpError) {
      // Turnstile tokens are single-use — always re-solve after a failed submit.
      captchaRef.current?.reset();

      if (isAuthRequestRateLimited(signUpError)) {
        await logAuthEvent({
          event_type: 'sign_up',
          event_data: {
            email,
            provider: 'email',
            reason: 'request_rate_limit',
          },
          success: false,
          error_message: signUpError.message,
        });
        setError(AUTH_SIGN_UP_RATE_LIMIT_MESSAGE);
        return;
      }

      // Record failed attempt on server
      await recordFailedAttempt(email, 'sign_up');

      // Log failed sign-up attempt (T034)
      await logAuthEvent({
        event_type: 'sign_up',
        event_data: { email, provider: 'email' },
        success: false,
        error_message: signUpError.message,
      });

      setError(signUpError.message);
    } else {
      // #49: the successful 'sign_up' audit event is now written by the
      // create_user_profile() trigger (AFTER INSERT ON auth.users), which fires
      // for EVERY signup path (form, OAuth, admin API) — so the previous
      // form-only logAuthEvent() call here was both incomplete (missed OAuth/
      // admin) and, after the trigger, a double-write. Removed; the trigger is
      // the single source of truth for successful signups. The failed-attempt
      // logAuthEvent() above stays (no auth.users INSERT happens on failure).

      // Initialize encryption keys and send welcome message (Feature 004)
      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        // Initialize keys with password
        logger.info('New user - initializing encryption keys');
        const keyPair = await keyManagementService.initializeKeys(password);

        // Send welcome message (non-blocking)
        Promise.all([
          import('@/services/messaging/welcome-service'),
          import('@/lib/supabase/client'),
        ])
          .then(([{ welcomeService }, { supabase: supabaseClient }]) => {
            supabaseClient.auth
              .getUser()
              .then(({ data }: { data: { user: { id: string } | null } }) => {
                if (
                  data?.user?.id &&
                  keyPair.privateKey &&
                  keyPair.publicKeyJwk
                ) {
                  welcomeService
                    .sendWelcomeMessage(
                      data.user.id,
                      keyPair.privateKey,
                      keyPair.publicKeyJwk
                    )
                    .catch((err: Error) => {
                      logger.error('Welcome message failed', { error: err });
                    });
                }
              });
          })
          .catch((err: Error) => {
            logger.error('Failed to load welcome service', { error: err });
          });
      } catch (keyError) {
        logger.error('Failed to initialize encryption keys', {
          error: keyError,
        });
        // Don't block signup flow
      }

      onSuccess?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-6${className ? ` ${className}` : ''}`}
    >
      <label className="flex w-full flex-col" htmlFor="email">
        <span className="label-text mb-1">Email</span>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered min-h-11 w-full"
          placeholder="you@example.com"
          required
          disabled={loading}
        />
      </label>

      <div className="flex w-full flex-col">
        <label className="label-text mb-1" htmlFor="password">
          Password
        </label>
        <PasswordField
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading}
          className="w-full"
        />
        {password ? (
          <PasswordStrengthIndicator password={password} className="mt-2" />
        ) : null}
      </div>

      <label className="flex w-full flex-col" htmlFor="confirm-password">
        <span className="label-text mb-1">Confirm Password</span>
        <PasswordField
          id="confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading}
          className="w-full"
        />
      </label>

      <label className="label flex min-h-11 cursor-pointer items-center justify-start gap-3 p-0">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="checkbox checkbox-primary"
          disabled={loading}
        />
        <span className="label-text">Remember me</span>
      </label>

      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary min-h-11 w-full"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : (
          'Sign Up'
        )}
      </button>
    </form>
  );
}
