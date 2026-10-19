'use client';

import React, { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';

export interface EmailVerificationNoticeProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * EmailVerificationNotice component
 * Resend verification email notice
 *
 * @category molecular
 */
export default function EmailVerificationNotice({
  className = '',
}: EmailVerificationNoticeProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);

  const resendVerification = async () => {
    if (!user?.email) return;

    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the bot check first.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });

    setLoading(false);

    if (resendError) {
      // Turnstile tokens are single-use; a spent one would block every retry.
      captchaRef.current?.reset();
      setError(resendError.message);
    } else {
      setSuccess(true);
    }
  };

  if (!user || user.email_confirmed_at) {
    return null;
  }

  if (success) {
    return (
      <div className={`alert alert-success${className ? ` ${className}` : ''}`}>
        <span>Verification email sent! Check your inbox.</span>
      </div>
    );
  }

  return (
    <div className={`alert alert-warning${className ? ` ${className}` : ''}`}>
      <span>Please verify your email address.</span>
      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />
      <button
        onClick={resendVerification}
        className="btn btn-sm min-h-11 min-w-11"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          'Resend'
        )}
      </button>
      {error && <span className="text-error">{error}</span>}
    </div>
  );
}
