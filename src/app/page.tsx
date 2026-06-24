import Link from 'next/link';

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
    tone: 'text-warning',
  },
];

const PETS = [
  {
    name: 'Biscuit',
    emoji: '🐶',
    detail: '2 yrs · loves belly rubs & long walks',
    bg: 'bg-[#f1f6ff]',
    border: 'border-[#cfe0ff]',
    image: 'from-[#d7e6ff] to-[#e9f1ff]',
    title: 'text-[#27408f]',
    cta: 'btn-primary',
  },
  {
    name: 'Pepper',
    emoji: '🐾',
    detail: '4 yrs · smart, loyal, and treat motivated',
    bg: 'bg-[#fff4f4]',
    border: 'border-[#ffd2d4]',
    image: 'from-[#ffd9da] to-[#ffe9ea]',
    title: 'text-[#c0353a]',
    cta: 'btn-secondary',
  },
  {
    name: 'Tank',
    emoji: '🦴',
    detail: '6 yrs · gentle giant with couch-potato energy',
    bg: 'bg-[#fffaf0]',
    border: 'border-[#ffd277]',
    image: 'from-[#ffe7a3] to-[#fff6d8]',
    title: 'text-[#8a6500]',
    cta: 'btn-accent',
  },
] as const;

const STEPS = [
  {
    number: '1',
    title: 'Browse & pick',
    detail: 'Meet our pets and find the one that makes your heart melt.',
    bg: 'bg-accent text-accent-content',
  },
  {
    number: '2',
    title: 'Apply online',
    detail: 'Send one application and track every update in real time.',
    bg: 'bg-primary text-primary-content',
  },
  {
    number: '3',
    title: 'Bring them home',
    detail: 'Work with the shelter team and start your happily-ever-after.',
    bg: 'bg-secondary text-secondary-content',
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
        className="relative bg-gradient-to-b from-[#2f6bff] to-[#5b8cff] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <div className="font-friendly bg-accent text-accent-content mb-6 inline-flex items-center rounded-full px-5 py-2 text-sm font-bold shadow-lg sm:text-base">
              🐾 Dogs · Cats & more
            </div>

            <h1
              id="hero-heading"
              className="font-display mb-5 text-5xl leading-none font-extrabold tracking-tight text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.14)] sm:text-6xl lg:text-7xl"
            >
              Find your new
              <br />
              best friend!
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed font-semibold text-[#eaf1ff] sm:text-xl lg:mx-0">
              Every wagging tail is waiting for a forever home. Browse pets,
              apply online, and follow each adoption update live.
            </p>

            <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
              <Link
                href="/adopt"
                className="btn btn-secondary btn-lg min-h-11 px-10 text-lg"
              >
                Adopt a Pet
              </Link>
              <Link
                href="/sign-in"
                className="btn btn-accent btn-lg min-h-11 px-10 text-lg"
              >
                View Demo
              </Link>
            </div>
          </div>

          <div className="relative h-72 w-full max-w-sm shrink-0 animate-[floaty_5s_ease-in-out_infinite] sm:h-80 lg:h-[400px] lg:max-w-[440px]">
            <div className="absolute inset-0 rotate-3 rounded-[2rem] border-[7px] border-[#ffd23f] bg-white shadow-2xl" />
            <div className="absolute inset-4 rotate-3 rounded-[1.625rem] bg-[repeating-linear-gradient(45deg,#dbe6ff,#dbe6ff_14px,#edf2ff_14px,#edf2ff_28px)]">
              <div className="grid h-full place-items-center text-center">
                <div>
                  <div
                    className="text-7xl drop-shadow-xl sm:text-8xl"
                    role="img"
                    aria-label="Happy rescue pets"
                  >
                    🐶🐱
                  </div>
                  <p className="font-friendly mt-4 text-lg font-bold text-[#27408f]">
                    Happy tails start here
                  </p>
                </div>
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

      <section aria-label="Rescue impact" className="bg-base-100 px-4 py-10">
        <div className="mx-auto grid max-w-4xl gap-8 text-center sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div
                className={`font-display text-4xl font-extrabold drop-shadow-sm sm:text-5xl ${stat.tone}`}
              >
                {stat.value}
              </div>
              <p className="text-base-content/70 font-bold">{stat.label}</p>
            </div>
          ))}
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
          <p className="text-base-content/70 mt-2 mb-8 text-lg font-semibold">
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
                    <p className="text-base-content/70 font-semibold">
                      {pet.detail}
                    </p>
                  </div>
                  <Link href="/adopt" className={`btn ${pet.cta} w-full`}>
                    Meet {pet.name}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
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
                <p className="text-base-content/70 mt-2 font-semibold">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-base-100 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-[#ff5a5f] p-8 text-white shadow-2xl sm:p-12 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Want to see the live rescue loop?
            </h2>
            <p className="mt-2 max-w-2xl text-lg font-bold text-[#ffe3e4]">
              Sign in with the demo accounts to watch adopter and shelter
              updates sync in real time.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 lg:mt-0 lg:shrink-0">
            <Link href="/sign-in" className="btn bg-white text-[#ff5a5f]">
              Try Demo Login
            </Link>
            <Link href="/applications/status/" className="btn btn-accent">
              Status Tracker
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
