import type { Metadata } from 'next';
import { ContactForm } from '@/components/forms/ContactForm';
import { projectConfig } from '@/config/project.config';

export const metadata: Metadata = {
  title: 'Contact | Raised Paws',
  description:
    'Contact Raised Paws about pilot interest, product feedback, or support for shelters, rescues, and adopters.',
  keywords: [
    'contact',
    'support',
    'pilot',
    'shelter',
    'rescue',
    'adopter',
    'Raised Paws',
  ],
  openGraph: {
    title: 'Contact | Raised Paws',
    description:
      'Reach the Raised Paws team about pilots, feedback, or support.',
    type: 'website',
  },
};

/**
 * Static page (GitHub Pages export). Role preselect from ?role= is handled
 * client-side in ContactForm — searchParams are not available at build time (#128).
 */
export default function ContactPage() {
  const publicEmail = projectConfig.contactEmail;

  return (
    <main className="relative container mx-auto min-h-screen overflow-hidden px-4 py-6 sm:py-8 md:py-12">
      {/* Soft brand wash behind the form column */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 right-0 h-72 w-72 rounded-full bg-[#f97316]/15 blur-3xl sm:top-16 sm:right-8 md:h-96 md:w-96"
      />

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="font-display mb-3 !text-2xl font-extrabold tracking-tight text-[#1e3a8a] sm:!text-4xl md:!text-5xl">
            Contact Raised Paws
          </h1>
          <p className="text-base-content/85 text-base sm:text-lg md:text-xl">
            Questions about a pilot, product feedback, or help using the
            tracker? Send a note — we read every message.
          </p>
        </div>

        <div className="mb-8 grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
                What we can help with
              </h2>
              <ul className="text-base-content/80 space-y-2">
                <li className="flex items-start">
                  <CheckIcon />
                  Shelter or rescue pilot interest
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  Adopter questions about applications and status tracking
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  Product feedback and feature ideas
                </li>
                <li className="flex items-start">
                  <CheckIcon />
                  Account or access support
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold sm:text-xl">
                Response time
              </h3>
              <p className="text-base-content/80 text-sm sm:text-base">
                We typically reply within 1–2 business days.
              </p>
            </div>

            {publicEmail ? (
              <div>
                <h3 className="mb-2 text-lg font-semibold sm:text-xl">
                  Email us directly
                </h3>
                <p className="text-base-content/80 text-sm sm:text-base">
                  Prefer mail?{' '}
                  <a
                    href={`mailto:${publicEmail}`}
                    className="link font-semibold text-[var(--brand-ink)]"
                  >
                    {publicEmail}
                  </a>
                </p>
              </div>
            ) : null}
          </div>

          {/* Orange outline + glow — brand accent without a heavy card look */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#ea580c] opacity-90 blur-[1px]"
            />
            <div className="bg-base-100 relative rounded-[1.25rem] border-2 border-[#f97316]/80 p-1 shadow-[0_12px_28px_rgba(249,115,22,0.28),0_4px_0_#ea580c]">
              <div className="bg-base-100 rounded-[1.05rem] p-4 sm:p-6">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      className="mt-1 mr-2 h-5 w-5 flex-shrink-0 text-[#f97316]"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}
