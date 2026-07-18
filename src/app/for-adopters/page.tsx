import type { Metadata } from 'next';
import Link from 'next/link';
import {
  buildSignInHref,
  buildSignUpHref,
} from '@/lib/portal/portal-preference';

export const metadata: Metadata = {
  title: 'For adopters - Raised Paws',
  description:
    'Apply once and track your pet adoption application live so you are never ghosted.',
};

export default function ForAdoptersPage() {
  return (
    <main className="bg-base-100 min-h-full">
      <section className="bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center lg:text-left">
          <p className="font-friendly text-sm font-bold tracking-wide text-[#f97316] uppercase">
            For Adopters
          </p>
          <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Track your adoption—so you&apos;re never ghosted
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/90 sm:text-xl">
            Raised Paws is an adoption application tracker: apply once, watch
            every status update live, and know where you stand without chasing
            the shelter for news.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={buildSignInHref('adopter')}
              className="btn btn-secondary btn-lg min-h-11 px-8"
            >
              Log In
            </Link>
            <Link
              href={buildSignUpHref('adopter')}
              className="btn btn-accent btn-lg min-h-11 px-8"
            >
              Create Account
            </Link>
            <Link
              href="/#meet-pets-heading"
              className="btn btn-ghost btn-lg min-h-11 border-white/30 px-8 text-white"
            >
              Browse Pets
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-base-content text-2xl font-extrabold sm:text-3xl">
          How it works for you
        </h2>
        <ul className="text-base-content/80 mt-6 space-y-4 text-lg leading-relaxed">
          <li>
            <strong className="text-base-content">One application.</strong> Stop
            rewriting the same form for every rescue.
          </li>
          <li>
            <strong className="text-base-content">Live status.</strong> See
            submitted, in review, and next steps as the shelter updates them.
          </li>
          <li>
            <strong className="text-base-content">No guessing.</strong> Less
            silence, more clarity while you wait for your match.
          </li>
        </ul>
        <p className="text-base-content/70 mt-8 text-sm">
          Looking for the shelter side instead?{' '}
          <Link href="/for-shelters" className="link link-primary">
            For Shelters
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
