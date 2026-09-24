'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { captchaConfig } from '@/config/captcha.config';

export interface CaptchaWidgetProps {
  /**
   * Called with a fresh CAPTCHA token when the challenge is solved, and with
   * `null` whenever the token stops being valid (expired, errored, or reset).
   * Treat `null` as "not verified" and block submission — tokens are
   * single-use and short-lived.
   */
  onToken: (token: string | null) => void;
  /** Additional CSS classes */
  className?: string;
}

/** Imperative handle so a parent form can force a re-solve. */
export interface CaptchaWidgetHandle {
  /**
   * Discard the current challenge and issue a new one. Required after ANY
   * failed submit: Turnstile tokens are single-use, so the spent token would
   * otherwise sit in the widget, `onSuccess` would never fire again, and the
   * user could never retry.
   */
  reset: () => void;
}

/**
 * Viewport below this uses Turnstile `compact` (150×140) so the 300px-min
 * flexible/normal sizes do not overflow a padded 320px form column (#488).
 * At/above it we use `flexible`, stretched across a centered `max-w-xs`
 * wrapper so it reads as a horizontal rectangle slightly narrower than the
 * form's full-width submit button.
 */
export const TURNSTILE_FLEXIBLE_MIN_WIDTH_PX = 400;

type TurnstileSize = 'compact' | 'flexible';

function turnstileSizeForViewport(width: number): TurnstileSize {
  return width >= TURNSTILE_FLEXIBLE_MIN_WIDTH_PX ? 'flexible' : 'compact';
}

/**
 * Sign-up bot protection (#353) — a Cloudflare Turnstile challenge.
 *
 * Renders NOTHING and reports no token when `NEXT_PUBLIC_CAPTCHA_SITE_KEY` is
 * unset. That keeps forks and local dev working untouched, and lets this ship
 * ahead of the Supabase-side enforcement so there is never a window where
 * sign-up is broken. See `src/config/captcha.config.ts`.
 *
 * Supabase verifies the token server-side on `auth.signUp`; nothing here is a
 * security boundary on its own — a bot can always skip the widget and post
 * directly. The control that actually matters is
 * `SECURITY_CAPTCHA_ENABLED = true` in Supabase Auth.
 *
 * Requires `https://challenges.cloudflare.com` in the CSP's `script-src`,
 * `frame-src` and `connect-src` (see `src/app/layout.tsx`).
 *
 * @category auth
 */
const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(
  function CaptchaWidget({ onToken, className = '' }, ref) {
    const instance = useRef<TurnstileInstance>(null);
    // Prefer the wide horizontal widget on first paint.
    // Narrow phones swap to compact after measure + remount (`key={size}`).
    const [size, setSize] = useState<TurnstileSize>('flexible');

    useImperativeHandle(ref, () => ({
      reset: () => {
        instance.current?.reset();
        onToken(null);
      },
    }));

    useEffect(() => {
      const mq = window.matchMedia(
        `(min-width: ${TURNSTILE_FLEXIBLE_MIN_WIDTH_PX}px)`
      );
      const apply = () => setSize(mq.matches ? 'flexible' : 'compact');
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }, []);

    if (!captchaConfig.enabled || !captchaConfig.siteKey) return null;

    return (
      <div
        className={`captcha-widget mx-auto flex w-full max-w-xs min-w-0 justify-center${className ? ` ${className}` : ''}`}
        data-testid="captcha-widget"
        data-turnstile-size={size}
      >
        <Turnstile
          key={size}
          ref={instance}
          siteKey={captchaConfig.siteKey}
          style={size === 'flexible' ? { width: '100%' } : undefined}
          onSuccess={(token) => onToken(token)}
          // A token is single-use and expires (~5 min). Clearing it forces a
          // fresh solve rather than submitting a stale token that Supabase
          // would reject with a confusing error.
          onExpire={() => onToken(null)}
          onError={() => onToken(null)}
          options={{ theme: 'auto', size }}
        />
      </div>
    );
  }
);

export default CaptchaWidget;
export { turnstileSizeForViewport };
