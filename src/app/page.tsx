import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { detectedConfig } from '@/config/project-detected';
import MeetThePetsSection from './_home/MeetThePetsSection';

/** Early-stage placeholders (#79) — not live shelter counts. */
const STATS = [
  {
    value: '16',
    label: 'pets rescued',
    tone: 'text-primary',
  },
  {
    value: '9',
    label: 'happy families',
    tone: 'text-secondary',
  },
  {
    value: '4',
    label: 'shelters & rescues',
    tone: 'text-info',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Browse & Pick',
    detail: 'Meet our pets and find the one that makes your heart melt.',
    bg: 'bg-primary text-primary-content',
  },
  {
    number: '2',
    title: 'Apply Online',
    detail: 'Send one application and track every update in real time.',
    bg: 'bg-accent text-accent-content',
  },
  {
    number: '3',
    title: 'Bring Them Home',
    detail:
      'Work with the shelter or rescue team and start your happily-ever-after.',
    bg: 'bg-[#d7e6ff] text-[#1e3a8a]',
  },
] as const;

/**
 * Desktop (xl+): slide the copy chunk left, away from the photo.
 * Raise this number to go further left; lower to go right.
 */
const HERO_COPY_NUDGE_LEFT_PX = 64;

const HERO_SPECIES_PILL_CLASS =
  'font-friendly border-accent inline-flex min-h-8 w-auto items-center justify-center gap-1.5 rounded-full border-2 text-base-content bg-transparent px-3 py-1 text-xs font-bold shadow-none transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_rgba(249,115,22,0.55),0_8px_22px_rgba(249,115,22,0.4)] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_0_0_3px_rgba(249,115,22,0.55),0_8px_22px_rgba(249,115,22,0.4)] sm:min-h-11 sm:gap-2 sm:px-5 sm:py-2 sm:text-base';

/**
 * Orange button with deep navy text. Navy on #f97316 is 5.24:1, which only
 * passes AAA as large text, so the label must stay at least 19px bold.
 * `!font-bold`: the theme `.btn` rule in globals.css sets weight 600.
 */
const ORANGE_BTN_CLASS =
  'btn border-0 bg-[#f97316] text-[1.1875rem] !font-bold text-[#172554] hover:bg-[#fb8a3c]';

export default function Home() {
  return (
    <main className="bg-base-100 flex min-h-full flex-col overflow-hidden">
      {/* Skip link — load-bearing a11y, do not remove (PRP-017 T036). */}
      <a
        href="#main-content"
        className="btn btn-sm btn-primary sr-only min-h-11 min-w-11 focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
      >
        Skip To Main Content
      </a>

      <section
        id="main-content"
        aria-labelledby="hero-heading"
        className="page-hero relative px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-24"
      >
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 xl:flex-row xl:items-center xl:gap-12">
          <div className="w-full min-w-0 flex-1 xl:-translate-y-4">
            {/* Centered copy stack, shifted left at xl+. Tweak HERO_COPY_NUDGE_LEFT_PX. */}
            <div
              className="mx-auto max-w-xl text-center xl:mx-0 xl:translate-x-[var(--hero-copy-nudge)]"
              style={
                {
                  ['--hero-copy-nudge']: `-${HERO_COPY_NUDGE_LEFT_PX}px`,
                } as CSSProperties
              }
            >
              <div className="mb-3 flex flex-row flex-wrap items-center justify-center gap-2 sm:mb-6 sm:gap-3">
                <Link
                  href="/dogs"
                  aria-label="Browse dogs"
                  className={HERO_SPECIES_PILL_CLASS}
                >
                  <span aria-hidden="true" className="inline-block">
                    🐾
                  </span>
                  Dogs
                </Link>
                <Link
                  href="/cats"
                  aria-label="Browse cats"
                  className={HERO_SPECIES_PILL_CLASS}
                >
                  <span aria-hidden="true" className="inline-block">
                    🐾
                  </span>
                  Cats
                </Link>
              </div>
              <h1
                id="hero-heading"
                className="font-display text-base-content mb-5 text-3xl leading-tight font-bold tracking-tight break-normal sm:text-4xl sm:leading-tight xl:text-5xl"
              >
                Track your pet adoption applications.
              </h1>

              <p className="hero-subcopy mb-8 text-lg leading-relaxed font-medium break-normal sm:text-xl">
                Apply once, watch every status update live, and give shelters
                &amp; rescues a simple pipeline.
              </p>

              <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link
                  href="/get-started?choose=1&intent=signup"
                  className={`${ORANGE_BTN_CLASS} min-h-11 w-full px-6 sm:w-auto`}
                >
                  Create Account
                </Link>
                <Link
                  href="/get-started?demo=1&choose=1"
                  className="btn border-base-content text-base-content hover:bg-base-100 min-h-11 w-full border-2 bg-transparent px-6 text-[1.1875rem] !font-bold sm:w-auto"
                >
                  Try Demo
                </Link>
              </div>
            </div>
          </div>

          {/* Right column: hero image
              Tune these Tailwind knobs:
              - Whole column up/down: `xl:-mt-*` on this outer div (negative = higher)
              - Photo up/down: `xl:-mt-*` on the image wrapper
              - Photo size: `max-w-md` / `xl:max-w-[640px]` on the column
          */}
          <div className="flex w-full max-w-md min-w-0 shrink-0 flex-col items-center gap-4 xl:-mt-8 xl:max-w-[640px] xl:items-stretch">
            <div className="hero-float relative aspect-[4/3] w-full xl:mt-2">
              <div className="absolute inset-0 rotate-1 rounded-[2rem] border-[7px] border-[#f97316] bg-white shadow-2xl sm:rotate-3" />
              <div className="absolute inset-2 rotate-1 overflow-hidden rounded-[1.625rem] sm:rotate-3">
                <Image
                  src={`${detectedConfig.basePath}/hero-held-paws.png`}
                  alt="A smiling adopter with a rescued dog and cat in a sunny park"
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute -bottom-px left-0 h-12 w-full sm:h-16"
        >
          <path
            d="M0,60 C260,10 520,10 760,35 C1010,60 1240,55 1440,20 L1440,60 Z"
            fill="var(--color-base-100)"
          />
        </svg>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="bg-base-100 px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl text-center">
          <h2
            id="how-it-works-heading"
            className="font-display text-base-content mb-10 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            How adopting works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="px-3">
                <div
                  className={`font-display mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-3xl font-bold shadow-md ${step.bg}`}
                >
                  {step.number}
                </div>
                <h3 className="font-friendly text-base-content text-xl font-bold">
                  {step.title}
                </h3>
                <p className="text-base-content/95 mt-2">{step.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-base-content/70 mt-10 text-sm">
            Building with us from the sidelines?{' '}
            <Link href="/follow" className="link link-primary">
              Join the early interest list
            </Link>
            .
          </p>
        </div>
      </section>

      <MeetThePetsSection />

      <section aria-label="Rescue impact" className="bg-base-100 px-4 py-10">
        <div className="mx-auto grid max-w-4xl gap-8 text-center sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div
                className={`font-display text-3xl font-bold tracking-tight sm:text-4xl ${stat.tone}`}
              >
                {stat.value}
              </div>
              <p className="text-base-content/95 font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="text-base-content/70 mx-auto mt-6 max-w-xl text-center text-sm font-medium">
          Demo / early numbers — growing with our shelters &amp; rescues.
        </p>
      </section>

      <section
        aria-labelledby="live-loop-heading"
        className="bg-base-100 px-4 pb-12 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-[#172554] p-8 shadow-2xl sm:p-10">
          <h2
            id="live-loop-heading"
            className="font-display text-2xl font-bold tracking-tight text-[#fdfbf7] sm:text-3xl"
          >
            Want to see the live rescue loop?
          </h2>
          <p className="mt-3 w-full text-base font-semibold text-[#dbe4f3] sm:text-lg">
            Choose the adopter or shelter door, sign in with a prefilled demo
            account, then walk the real loop: submit or review an application,
            move statuses in the shelter pipeline, and watch updates sync live
            on the other side. You can switch demo roles anytime from the
            account menu.
          </p>
          {/* Under the copy, centered at every width */}
          <div className="mt-5 flex justify-center">
            <Link
              href="/get-started?demo=1&choose=1"
              className={`${ORANGE_BTN_CLASS} min-h-12 px-8`}
            >
              Try Demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
