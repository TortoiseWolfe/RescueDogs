'use client';

import React from 'react';
import Link from 'next/link';
import {
  buildPortalAuthHref,
  setPortalPreference,
  type PortalAuthIntent,
  type PortalType,
} from '@/lib/portal/portal-preference';

export interface PortalChooserProps {
  /** Optional returnUrl after auth (must be same-origin path). */
  returnUrl?: string | null;
  /** Route doors to sign-in or sign-up. */
  intent?: PortalAuthIntent;
  /** Highlight demo credentials under the doors (public seed accounts). */
  showDemoHints?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Called after a door is chosen (preference already saved). */
  onSelect?: (portal: PortalType) => void;
}

const DOORS: Array<{
  portal: PortalType;
  title: string;
  subtitle: string;
  ctaSignIn: string;
  ctaSignUp: string;
  accent: string;
}> = [
  {
    portal: 'adopter',
    title: "I'm adopting",
    subtitle:
      "Apply once and track every status update live so you're never ghosted.",
    ctaSignIn: 'Continue as adopter',
    ctaSignUp: 'Create adopter account',
    accent: 'border-[#f97316]',
  },
  {
    portal: 'shelter',
    title: "I'm a shelter / rescue",
    subtitle:
      'Review applications in a simple pipeline and keep adopters in the loop.',
    ctaSignIn: 'Continue as shelter',
    ctaSignUp: 'Create shelter account',
    accent: 'border-[#1e3a8a]',
  },
];

/**
 * Equal-weight adopter vs shelter portal doors (#48).
 * Preference is local only — membership still controls access after auth.
 *
 * @category molecular
 */
export default function PortalChooser({
  returnUrl = null,
  intent = 'sign-in',
  showDemoHints = false,
  className = '',
  onSelect,
}: PortalChooserProps) {
  const handleSelect = (portal: PortalType) => {
    setPortalPreference(portal);
    onSelect?.(portal);
  };

  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      <div
        className="grid gap-4 sm:gap-6 md:grid-cols-2"
        role="group"
        aria-label="Choose adopter or shelter portal"
      >
        {DOORS.map((door) => (
          <Link
            key={door.portal}
            href={buildPortalAuthHref(door.portal, intent, returnUrl)}
            onClick={() => handleSelect(door.portal)}
            className={`border-base-300 bg-base-100 hover:border-primary focus-visible:outline-primary flex min-h-11 flex-col rounded-2xl border-2 p-6 text-left shadow-sm transition-colors ${door.accent}`}
          >
            <h2 className="font-display text-base-content text-2xl font-extrabold">
              {door.title}
            </h2>
            <p className="text-base-content/80 mt-2 flex-1 text-base leading-relaxed">
              {door.subtitle}
            </p>
            <span className="btn btn-primary mt-6 min-h-11 w-full sm:w-auto">
              {intent === 'sign-up' ? door.ctaSignUp : door.ctaSignIn}
            </span>
          </Link>
        ))}
      </div>

      {showDemoHints ? (
        <div className="bg-base-200 mt-8 rounded-2xl p-5 text-sm">
          <p className="font-semibold">Try the live demo loop</p>
          <p className="text-base-content/80 mt-1">
            Demo-only accounts (password{' '}
            <code className="bg-base-300 rounded px-1">DemoPass123!</code>
            ):
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              Adopter:{' '}
              <code className="bg-base-300 rounded px-1">
                adopter@demo.test
              </code>
            </li>
            <li>
              Shelter staff:{' '}
              <code className="bg-base-300 rounded px-1">staff@demo.test</code>
            </li>
          </ul>
          <p className="text-base-content/70 mt-3">
            Pick a door above, sign in with the matching account, then open{' '}
            <Link href="/applications" className="link link-primary">
              applications
            </Link>{' '}
            or{' '}
            <Link href="/shelter" className="link link-primary">
              shelter pipeline
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
