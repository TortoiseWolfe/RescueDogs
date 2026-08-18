import type { Metadata } from 'next';
import Link from 'next/link';
import { InterestForm } from '@/components/forms/InterestForm';

export const metadata: Metadata = {
  title: 'Follow | Raised Paws',
  description:
    'Join the Raised Paws early interest list for occasional updates when there is something real for shelters, rescues, or adopters.',
  keywords: [
    'follow',
    'early interest',
    'updates',
    'Raised Paws',
    'pet adoption',
  ],
  openGraph: {
    title: 'Follow | Raised Paws',
    description:
      'Occasional Raised Paws updates — no spam, no interruptive popups.',
    type: 'website',
  },
};

/**
 * Early interest list (#129). Soft capture only — no popups / header CTA.
 * Submits through the same Web3Forms stack as Contact (static GitHub Pages).
 */
export default function FollowPage() {
  return (
    <main className="relative container mx-auto min-h-screen overflow-hidden px-4 py-6 sm:py-8 md:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 left-0 h-72 w-72 rounded-full bg-[#f97316]/15 blur-3xl sm:top-16 sm:left-8 md:h-96 md:w-96"
      />

      <div className="relative mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <p className="font-friendly text-sm font-bold tracking-wide text-[var(--brand-ink)] uppercase">
            Early interest
          </p>
          <h1 className="font-display mt-2 !text-2xl font-extrabold tracking-tight text-[#1e3a8a] sm:!text-4xl md:!text-5xl">
            Follow Raised Paws
          </h1>
          <p className="text-base-content/85 mx-auto mt-4 max-w-xl text-base sm:text-lg">
            We are building an anti-ghosting adoption tracker — live status for
            adopters, a clearer pipeline for shelters and rescues. Leave your
            email for occasional updates when there is something real. No spam,
            and we will never block the site for a signup popup.
          </p>
        </div>

        <div className="bg-base-100 border-base-300 rounded-box border p-5 shadow-sm sm:p-8">
          <InterestForm />
        </div>

        <p className="text-base-content/70 mt-8 text-center text-sm">
          Shelter or rescue wanting to talk pilot?{' '}
          <Link
            href="/contact?role=shelter"
            className="link link-primary inline-flex min-h-11 items-center"
          >
            Contact us
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
