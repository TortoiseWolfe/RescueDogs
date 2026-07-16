import Link from 'next/link';
import Image from 'next/image';
import { detectedConfig } from '@/config/project-detected';

const STATS = [
  {
    value: '3,200+',
    label: 'pets rescued',
    tone: 'text-primary',
  },
  {
    value: '2,850',
    label: 'happy families',
    tone: 'text-secondary',
  },
  {
    value: '140',
    label: 'volunteers',
    tone: 'text-[#5da8e0]',
  },
];

const PETS = [
  {
    name: 'Biscuit',
    emoji: '🐶',
    detail: '2 yrs · loves belly rubs & long walks',
    bg: 'bg-[#e8edf7]',
    border: 'border-[#a8b8d8]',
    image: 'from-[#7a94c4] to-[#e8edf7]',
    title: 'text-[#1e3a8a]',
    cta: 'btn-primary',
  },
  {
    name: 'Pepper',
    emoji: '🐾',
    detail: '4 yrs · smart, loyal, and treat motivated',
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    image: 'from-[#ffedd5] to-[#fff7ed]',
    title: 'text-[#c2410c]',
    cta: 'btn-secondary',
  },
  {
    name: 'Tank',
    emoji: '🦴',
    detail: '6 yrs · gentle giant with couch-potato energy',
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'border-[#cfe0ff] bg-[#d7e6ff] text-[#27408f] hover:border-[#a8c4f5] hover:bg-[#cfe0ff]',
  },
] as const;

const STEPS = [
  {
    number: '1',
    title: 'Browse & pick',
    detail: 'Meet our pets and find the one that makes your heart melt.',
    bg: 'bg-[#1e3a8a] text-white',
  },
  {
    number: '2',
    title: 'Apply online',
    detail: 'Send one application and track every update in real time.',
    bg: 'bg-[#f97316] text-white',
  },
  {
    number: '3',
    title: 'Bring them home',
    detail: 'Work with the shelter team and start your happily-ever-after.',
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
        Skip to main content
      </a>

      <section
        id="main-content"
        aria-labelledby="hero-heading"
        className="relative bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-12">
          <div className="w-full min-w-0 flex-1 text-center lg:-translate-y-4 lg:text-left">
            <h1
              id="hero-heading"
              className="font-display mb-5 text-5xl leading-none font-extrabold tracking-tight break-words text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.14)] sm:text-6xl lg:text-7xl"
            >
              <span className="text-[#f97316]">Raised Paws</span> tracks your
              adoption application.
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed font-semibold text-[#f97316] sm:text-xl lg:mx-0">
              Apply once, watch every status update live, and give shelters a
              simple pipeline.
            </p>

            <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <Link
                href="/for-adopters"
                className="btn btn-secondary btn-lg min-h-11 w-full px-8 text-lg sm:w-auto"
              >
                For Adopters
              </Link>
              <Link
                href="/for-shelters"
                className="btn btn-accent btn-lg min-h-11 w-full px-8 text-lg sm:w-auto"
              >
                For Shelters
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/80 sm:text-base lg:text-left">
              <Link
                href="/#meet-pets-heading"
                className="link link-hover text-white"
              >
                Browse pets
              </Link>
            </p>
          </div>

          {/* Right column: badge + hero image
              Tune these Tailwind knobs:
              - Whole column up/down: `lg:-mt-*` on this outer div (negative = higher)
              - Badge right/left: `self-end` / `self-start` / `self-center`, plus `mr-*` or `ml-*`
              - Space between badge & photo: badge `mb-*` and column `gap-*`
              - Photo up/down relative to badge: `lg:-mt-*` on the image wrapper
              - Photo size: `max-w-md` / `lg:max-w-[640px]` on the column
          */}
          <div className="flex w-full max-w-md min-w-0 shrink-0 flex-col items-center gap-4 lg:-mt-16 lg:max-w-[640px] lg:items-stretch">
            <div className="font-friendly bg-accent text-accent-content mb-4 inline-flex -translate-y-4 items-center self-end rounded-full px-5 py-2 text-sm font-bold shadow-lg sm:text-base lg:mr-8 lg:-translate-y-4">
              🐾 Dogs and Cats
            </div>

            <div className="relative aspect-[4/3] w-full animate-[floaty_5s_ease-in-out_infinite] lg:-mt-4">
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
        </div>
      </section>

      <section
        aria-labelledby="meet-pets-heading"
        className="bg-base-100 px-4 py-10 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl text-center">
          <h2
            id="meet-pets-heading"
            className="font-display text-base-content text-4xl font-extrabold sm:text-5xl"
          >
            Say hello!
          </h2>
          <p className="text-base-content/95 mt-2 mb-8 text-lg font-semibold">
            A few demo pets are ready for your tour.
          </p>

          <div className="grid gap-7 md:grid-cols-3">
            {PETS.map((pet) => (
              <article
                key={pet.name}
                className={`card border-[3px] text-left ${pet.bg} ${pet.border}`}
              >
                <div className="card-body gap-4 p-4">
                  <div
                    className={`grid h-52 place-items-center rounded-2xl bg-gradient-to-br ${pet.image}`}
                  >
                    <span
                      className="text-7xl drop-shadow-lg"
                      role="img"
                      aria-label={`${pet.name} pet icon`}
                    >
                      {pet.emoji}
                    </span>
                  </div>
                  <div className="px-2">
                    <h3
                      className={`font-friendly text-2xl font-bold ${pet.title}`}
                    >
                      {pet.name}
                    </h3>
                    <p className="text-base-content/95 font-semibold">
                      {pet.detail}
                    </p>
                  </div>
                  <Link
                    href="/adopt"
                    className={`btn ${pet.cta} min-h-11 w-full`}
                  >
                    Meet {pet.name}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

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
      </section>

      <section className="bg-base-100 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-[#f97316] p-8 text-white shadow-2xl sm:p-12 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Want to see the live rescue loop?
            </h2>
            <p className="mt-2 max-w-2xl text-lg font-bold text-white">
              Sign in with the demo accounts to watch adopter and shelter
              updates sync in real time.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 lg:mt-0 lg:shrink-0">
            <Link
              href="/get-started?demo=1&choose=1"
              className="btn min-h-11 bg-white text-[#1e3a8a]"
            >
              Demo login tips
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
