'use client';

import React, { useState, useEffect } from 'react';
import SignUpForm from '@/components/auth/SignUpForm';
// OAuth (Google/GitHub) sign-up is hidden until the providers are enabled in
// Supabase. To restore: re-add this import and the <OAuthButtons /> block below.
// import OAuthButtons from '@/components/auth/OAuthButtons';
import Link from 'next/link';
import { getInternalUrl } from '@/config/project.config';
import {
  buildSignInHref,
  isPortalType,
  type PortalType,
} from '@/lib/portal/portal-preference';

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

export default function SignUpPage() {
  const [returnUrl, setReturnUrl] = useState('/profile');
  const [portal, setPortal] = useState<PortalType | null>(null);

  useEffect(() => {
    // Read query params client-side for static export compatibility
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url && isSafeRedirectUrl(decodeURIComponent(url))) {
      setReturnUrl(url);
    }
    const portalParam = params.get('portal');
    if (isPortalType(portalParam)) {
      setPortal(portalParam);
    }
  }, []);

  const heading =
    portal === 'shelter'
      ? 'Create shelter account'
      : portal === 'adopter'
        ? 'Create adopter account'
        : 'Create Account';

  const signInHref = portal
    ? buildSignInHref(portal, returnUrl !== '/profile' ? returnUrl : null)
    : `/sign-in${returnUrl !== '/profile' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`;

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-center text-3xl font-bold sm:mb-3">
          {heading}
        </h1>
        {portal ? (
          <p className="text-base-content/70 mb-6 text-center text-sm sm:mb-8">
            Wrong audience?{' '}
            <Link href="/for-adopters" className="link link-primary">
              For Adopters
            </Link>
            {' · '}
            <Link href="/for-shelters" className="link link-primary">
              For Shelters
            </Link>
            .
          </p>
        ) : (
          <p className="text-base-content/70 mb-6 text-center text-sm sm:mb-8">
            Not sure which door?{' '}
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

        <SignUpForm
          onSuccess={() =>
            (window.location.href = getInternalUrl('/verify-email'))
          }
        />

        {/* OAuth sign-up hidden until Google/GitHub providers are enabled in
            Supabase. Restore by un-commenting the import above and this block:
        <div className="divider my-6">OR</div>
        <OAuthButtons /> */}

        <p className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href={signInHref} className="link-primary">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
