import type { Metadata } from 'next';
import Link from 'next/link';
import { buildSignUpHref } from '@/lib/portal/portal-preference';

const heroCtaClassName =
  'btn btn-lg min-h-11 border-0 bg-white px-8 font-bold text-[#1e3a8a] hover:bg-[#e8edf7]';

export const metadata: Metadata = {
  title: 'For shelters & rescues - Raised Paws',
  description:
    'Anti-ghosting adoption pipeline for shelters and rescues: review applications and keep adopters updated in real time.',
};

export default function ForSheltersPage() {
  return (
    <main className="bg-base-100 min-h-full">
      <section className="bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center lg:text-left">
          <p className="font-friendly text-sm font-bold tracking-wide text-[#f97316] uppercase">
            For Shelters &amp; Rescues
          </p>
          <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            A simple pipeline that keeps adopters in the loop
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/90 sm:text-xl">
            Whether you run a brick-and-mortar shelter or a foster-based rescue,
            Raised Paws is the anti-ghosting adoption platform: one application
            in, a clear staff pipeline, and live status for applicants—so your
            team spends less time on “any update?” emails.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={buildSignUpHref('shelter')}
              className={heroCtaClassName}
            >
              Create Account
            </Link>
            <Link
              href="/get-started?demo=1&choose=1"
              className={heroCtaClassName}
            >
              Try Demo
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-base-content text-2xl font-extrabold sm:text-3xl">
          Built for volunteer capacity
        </h2>
        <ul className="text-base-content/80 mt-6 space-y-4 text-lg leading-relaxed">
          <li>
            <strong className="text-base-content">Pipeline dashboard.</strong>{' '}
            See every application and advance status without leaving the
            spreadsheet maze.
          </li>
          <li>
            <strong className="text-base-content">Live adopter tracker.</strong>{' '}
            When you update an application, applicants see it—no silence.
          </li>
          <li>
            <strong className="text-base-content">Staff access.</strong>{' '}
            Pipeline tools appear after your account is added as staff at your
            shelter or rescue.
          </li>
        </ul>
        <p className="text-base-content/70 mt-8 text-sm">
          Adopting instead?{' '}
          <Link href="/for-adopters" className="link link-primary">
            For Adopters
          </Link>
          . Want occasional product updates?{' '}
          <Link href="/follow" className="link link-primary">
            Join the early interest list
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
