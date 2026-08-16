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
    tone: 'text-[#5da8e0]',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Browse & Pick',
    detail: 'Meet our pets and find the one that makes your heart melt.',
    bg: 'bg-[#1e3a8a] text-white',
  },
  {
    number: '2',
    title: 'Apply Online',
    detail: 'Send one application and track every update in real time.',
    bg: 'bg-[#f97316] text-white',
  },
  {
    number: '3',
    title: 'Bring Them Home',
    detail:
      'Work with the shelter or rescue team and start your happily-ever-after.',
    bg: 'bg-[#d7e6ff] text-[#1e3a8a]',
  },
] as const;

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
        className="relative bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-10 text-white sm:px-6 sm:py-16 lg:px-8 lg:py-24"
      >
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-12">
          <div className="w-full min-w-0 flex-1 text-center lg:-translate-y-4 lg:text-left">
            <div className="mb-3 flex flex-row flex-wrap items-center justify-center gap-2 sm:mb-6 sm:gap-3 lg:justify-start">
              <Link
                href="/dogs"
                aria-label="Browse dogs"
                className="font-friendly bg-accent inline-flex min-h-8 w-auto items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg transition-opacity hover:opacity-90 sm:min-h-11 sm:gap-2 sm:px-5 sm:py-2 sm:text-base"
              >
                <span
                  aria-hidden="true"
                  className="inline-block brightness-0 invert"
                >
                  🐾
                </span>
                Dogs
              </Link>
              <Link
                href="/cats"
                aria-label="Browse cats"
                className="font-friendly bg-accent inline-flex min-h-8 w-auto items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg transition-opacity hover:opacity-90 sm:min-h-11 sm:gap-2 sm:px-5 sm:py-2 sm:text-base"
              >
                <span
                  aria-hidden="true"
                  className="inline-block brightness-0 invert"
                >
                  🐾
                </span>
                Cats
              </Link>
            </div>

            <h1
              id="hero-heading"
              className="font-display mb-5 text-4xl leading-tight font-extrabold tracking-tight break-normal text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.14)] sm:text-6xl sm:leading-none lg:text-7xl"
            >
              Track your pet adoption applications.
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed font-semibold break-normal text-[#f97316] sm:text-xl lg:mx-0">
              Apply once, watch every status update live, and give shelters
              &amp; rescues a simple pipeline.
            </p>

            <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <Link
                href="/get-started?choose=1&intent=signup"
                className="btn min-h-11 w-full border-0 bg-white px-6 text-sm font-bold text-[#1e3a8a] !shadow-[0_10px_18px_rgba(249,115,22,0.35),0_4px_0_#ea580c] hover:bg-[#e8edf7] hover:!shadow-[0_14px_24px_rgba(249,115,22,0.4),0_5px_0_#ea580c] sm:w-auto sm:text-base"
              >
                Create Account
              </Link>
              <Link
                href="/get-started?demo=1&choose=1"
                className="btn min-h-11 w-full border-0 bg-white px-6 text-sm font-bold text-[#1e3a8a] !shadow-[0_10px_18px_rgba(249,115,22,0.35),0_4px_0_#ea580c] hover:bg-[#e8edf7] hover:!shadow-[0_14px_24px_rgba(249,115,22,0.4),0_5px_0_#ea580c] sm:w-auto sm:text-base"
              >
                Try Demo
              </Link>
            </div>
          </div>

          {/* Right column: hero image
              Tune these Tailwind knobs:
              - Whole column up/down: `lg:-mt-*` on this outer div (negative = higher)
              - Photo up/down: `lg:-mt-*` on the image wrapper
              - Photo size: `max-w-md` / `lg:max-w-[640px]` on the column
          */}
          <div className="flex w-full max-w-md min-w-0 shrink-0 flex-col items-center gap-4 lg:-mt-8 lg:max-w-[640px] lg:items-stretch">
            <div className="relative aspect-[4/3] w-full animate-[floaty_5s_ease-in-out_infinite] lg:mt-2">
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
            className="font-display text-base-content mb-10 text-4xl font-extrabold sm:text-5xl"
          >
            How adopting works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="px-3">
                <div
                  className={`font-display mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full text-5xl font-extrabold shadow-xl ${step.bg}`}
                >
                  {step.number}
                </div>
                <h3 className="font-friendly text-base-content text-2xl font-bold">
                  {step.title}
                </h3>
                <p className="text-base-content/95 mt-2 font-semibold">
                  {step.detail}
                </p>
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
                className={`font-display text-4xl font-extrabold drop-shadow-sm sm:text-5xl ${stat.tone}`}
              >
                {stat.value}
              </div>
              <p className="text-base-content/95 font-bold">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="text-base-content/70 mx-auto mt-6 max-w-xl text-center text-sm font-medium">
          Demo / early numbers — growing with our shelters &amp; rescues.
        </p>
      </section>

      <section className="bg-base-100 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-[#f97316] p-8 text-white shadow-2xl sm:p-12 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Want to see the live rescue loop?
            </h2>
            <p className="mt-2 max-w-2xl text-base font-bold text-[#172554] sm:text-lg">
              Choose the adopter or shelter door, sign in with a prefilled demo
              account, then walk the real loop: submit or review an application,
              move statuses in the shelter pipeline, and watch updates sync live
              on the other side. You can switch demo roles anytime from the
              account menu.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 lg:mt-0 lg:shrink-0">
            <Link
              href="/get-started?demo=1&choose=1"
              className="btn btn-lg min-h-12 bg-white px-10 text-lg font-bold text-[#1e3a8a] hover:bg-[#e8edf7]"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
