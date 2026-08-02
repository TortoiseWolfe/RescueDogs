'use client';

import React, { useState, useEffect, useRef } from 'react';
import SignInForm from '@/components/auth/SignInForm';
// OAuth (Google/GitHub) sign-in is hidden until the providers are enabled in
// Supabase. To restore: re-add this import and the <OAuthButtons /> block below.
// import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  buildSignUpHref,
  DEMO_CREDENTIALS,
  isPortalType,
  setPortalPreference,
  type PortalType,
} from '@/lib/portal/portal-preference';
import { resolvePostLoginPath } from '@/lib/portal/resolve-post-login-path';
import { enterDemoMode } from '@/lib/demo/demo-session';

function isSafeRedirectUrl(url: string): boolean {
  if (!url || !url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function SignInPage() {
  const router = useRouter();
  /** Explicit returnUrl from query; null means resolve after login. */
  const [explicitReturnUrl, setExplicitReturnUrl] = useState<string | null>(
    null
  );
  const [portal, setPortal] = useState<PortalType | null>(null);
  const [demoPrefill, setDemoPrefill] = useState(false);
  const [demoSwitch, setDemoSwitch] = useState(false);
  const [switchFrom, setSwitchFrom] = useState<PortalType | null>(null);
  // Block onSuccess navigation until the returnUrl effect has run. On a
  // fast network or already-authenticated user, sign-in can resolve before
  // the URL-parsing effect finishes, sending the user to the default
  // destination instead of the intended /messages?conversation=xyz.
  const [mounted, setMounted] = useState(false);
  const explicitReturnUrlRef = useRef<string | null>(null);
  const portalRef = useRef<PortalType | null>(null);

  useEffect(() => {
    // Read query params client-side for static export compatibility
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url && isSafeRedirectUrl(decodeURIComponent(url))) {
      const decoded = decodeURIComponent(url);
      setExplicitReturnUrl(decoded);
      explicitReturnUrlRef.current = decoded;
    }
    const portalParam = params.get('portal');
    if (isPortalType(portalParam)) {
      setPortal(portalParam);
      portalRef.current = portalParam;
      setPortalPreference(portalParam);
    }
    const isDemo = params.get('demo') === '1';
    setDemoPrefill(isDemo);
    if (isDemo) {
      enterDemoMode(isPortalType(portalParam) ? portalParam : undefined);
    }
    const isSwitch = params.get('switch') === '1';
    setDemoSwitch(isSwitch);
    const fromParam = params.get('from');
    setSwitchFrom(isPortalType(fromParam) ? fromParam : null);
    setMounted(true);
  }, []);

  const demoCredentials =
    demoPrefill && portal ? DEMO_CREDENTIALS[portal] : null;

  const heading =
    portal === 'shelter'
      ? 'Shelter Sign In'
      : portal === 'adopter'
        ? 'Adopter Sign In'
        : 'Log In';

  const switchMessage =
    demoSwitch && portal
      ? portal === 'shelter'
        ? 'Switching to the shelter demo (Sam). Credentials are prefilled — sign in, change an application status, then switch back to the adopter to see that update on the tracker in real time.'
        : 'Switching to the adopter demo (Dana). Credentials are prefilled — sign in and open the application tracker to see the shelter’s status updates in real time.'
      : null;

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1
          className={`text-center text-3xl font-bold ${
            portal && !switchMessage ? 'mb-6 sm:mb-8' : 'mb-2 sm:mb-3'
          }`}
        >
          {heading}
        </h1>
        {switchMessage ? (
          <div
            className="alert alert-info mb-6 text-sm"
            role="status"
            data-testid="demo-switch-banner"
          >
            <span>{switchMessage}</span>
          </div>
        ) : portal ? null : (
          <p className="text-base-content/70 mb-6 text-center text-sm sm:mb-8">
            New here?{' '}
            <Link href="/for-adopters" className="link link-primary">
              For Adopters
            </Link>
            {' · '}
            <Link href="/for-shelters" className="link link-primary">
              For Shelters
            </Link>
            .
          </p>
        )}
        {switchFrom && demoSwitch && portal ? (
          <p className="text-base-content/60 mb-4 text-center text-xs">
            Coming from the {switchFrom} demo session.
          </p>
        ) : null}

        {!mounted ? (
          <div className="flex min-h-40 items-center justify-center">
            <span
              className="loading loading-spinner loading-lg"
              role="status"
              aria-label="Loading"
            />
          </div>
        ) : (
          <SignInForm
            initialEmail={demoCredentials?.email}
            initialPassword={demoCredentials?.password}
            showDemoBanner={Boolean(demoCredentials)}
            onSuccess={() => {
              if (!mounted) return;
              void (async () => {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                const userId = session?.user?.id;
                const path = userId
                  ? await resolvePostLoginPath({
                      userId,
                      explicitReturnUrl: explicitReturnUrlRef.current,
                      portal: portalRef.current,
                    })
                  : explicitReturnUrlRef.current || '/applications';
                router.push(path);
              })();
            }}
          />
        )}

        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="link-primary">
            Forgot Password?
          </Link>
        </p>

        {/* OAuth sign-in hidden until Google/GitHub providers are enabled in
            Supabase. Restore by un-commenting the import above and this block:
        <div className="divider my-6">OR</div>
        <OAuthButtons /> */}

        <p className="mt-6 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link
            href={
              portal
                ? buildSignUpHref(portal, explicitReturnUrl)
                : `/get-started?choose=1&intent=signup`
            }
            className="link-primary"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}
