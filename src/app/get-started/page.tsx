'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PortalChooser from '@/components/molecular/PortalChooser';
import {
  buildPortalAuthHref,
  getPortalPreference,
  isPortalType,
  type PortalAuthIntent,
} from '@/lib/portal/portal-preference';

function isSafeReturnUrl(url: string): boolean {
  if (!url || !url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Secondary portal switcher / demo tips (#48). Primary entry is homepage +
 * /for-adopters and /for-shelters.
 */
export default function GetStartedPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [showDemoHints, setShowDemoHints] = useState(false);
  const [intent, setIntent] = useState<PortalAuthIntent>('sign-in');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const force = params.get('choose') === '1';
    setShowDemoHints(params.get('demo') === '1');
    const intentParam = params.get('intent');
    const nextIntent: PortalAuthIntent =
      intentParam === 'signup' || intentParam === 'sign-up'
        ? 'sign-up'
        : 'sign-in';
    setIntent(nextIntent);

    const rawReturn = params.get('returnUrl');
    if (rawReturn) {
      const decoded = decodeURIComponent(rawReturn);
      if (isSafeReturnUrl(decoded)) setReturnUrl(decoded);
    }

    // Only auto-skip when not forcing a choice and not showing demo tips.
    if (!force && params.get('demo') !== '1') {
      const preferred = getPortalPreference();
      if (isPortalType(preferred)) {
        const dest = rawReturn
          ? isSafeReturnUrl(decodeURIComponent(rawReturn))
            ? decodeURIComponent(rawReturn)
            : null
          : null;
        router.replace(buildPortalAuthHref(preferred, nextIntent, dest));
        return;
      }
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <main className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-12">
        <span className="loading loading-spinner loading-lg" />
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {intent === 'sign-up' ? 'Create an account' : 'Demo & door switcher'}
        </h1>
        <p className="text-base-content/80 mx-auto mt-3 max-w-2xl text-lg">
          {intent === 'sign-up'
            ? 'Pick adopter or shelter so we can send you to the right sign-up.'
            : 'Use this page for demo credentials or to jump into a portal. Day-to-day, start from For Adopters / For Shelters on the homepage.'}
        </p>
      </div>

      <PortalChooser
        returnUrl={returnUrl}
        intent={intent}
        showDemoHints={showDemoHints || intent === 'sign-in'}
      />

      <p className="text-base-content/70 mt-8 text-center text-sm">
        <Link href="/for-adopters" className="link link-primary">
          For Adopters
        </Link>
        {' · '}
        <Link href="/for-shelters" className="link link-primary">
          For Shelters
        </Link>
        {' · '}
        <Link href="/sign-in" className="link link-primary">
          Log In
        </Link>
        {' · '}
        <Link href="/" className="link link-primary">
          Home
        </Link>
      </p>
    </main>
  );
}
