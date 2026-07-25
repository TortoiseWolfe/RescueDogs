import Link from 'next/link';

export type SpeciesBrowseKind = 'dogs' | 'cats';

const COPY: Record<
  SpeciesBrowseKind,
  {
    title: string;
    emoji: string;
    description: string;
    emptyHeading: string;
    emptyBody: string;
    otherHref: string;
    otherLabel: string;
  }
> = {
  dogs: {
    title: 'Browse dogs',
    emoji: '🐶',
    description:
      'Meet dogs available for adoption. Real shelter listings will show up here as partners join Raised Paws.',
    emptyHeading: 'No dogs listed yet',
    emptyBody:
      'We are building the browse experience first. When shelters add dogs, you will find them on this page — with filters coming later.',
    otherHref: '/cats',
    otherLabel: 'Browse cats',
  },
  cats: {
    title: 'Browse cats',
    emoji: '🐱',
    description:
      'Meet cats available for adoption. Real shelter listings will show up here as partners join Raised Paws.',
    emptyHeading: 'No cats listed yet',
    emptyBody:
      'We are building the browse experience first. When shelters add cats, you will find them on this page — with filters coming later.',
    otherHref: '/dogs',
    otherLabel: 'Browse dogs',
  },
};

/**
 * Shared empty-state browse chrome for /dogs and /cats (#91).
 * Not a Storybook component — app-local presentational helper.
 */
export default function SpeciesBrowseView({
  species,
}: {
  species: SpeciesBrowseKind;
}) {
  const copy = COPY[species];

  return (
    <main className="bg-base-100 min-h-full">
      <section className="bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-3xl text-center lg:text-left">
          <p className="font-friendly text-sm font-bold tracking-wide text-[#f97316] uppercase">
            Browse pets
          </p>
          <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span aria-hidden="true">{copy.emoji} </span>
            {copy.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/90 sm:text-xl">
            {copy.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={copy.otherHref}
              className="btn btn-ghost btn-lg min-h-11 border-white/30 px-8 text-white"
            >
              {copy.otherLabel}
            </Link>
            <Link
              href="/adopt"
              className="btn btn-secondary btn-lg min-h-11 px-8"
            >
              Apply to adopt
            </Link>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
        aria-labelledby="species-empty-heading"
      >
        <div className="card bg-base-200">
          <div className="card-body items-center gap-4 text-center">
            <h2
              id="species-empty-heading"
              className="font-display card-title text-2xl"
            >
              {copy.emptyHeading}
            </h2>
            <p className="text-base-content/80 max-w-md">{copy.emptyBody}</p>
            <p className="text-base-content/70 max-w-md text-sm">
              Prefer a guided tour with demo data?{' '}
              <Link
                href="/get-started?demo=1&choose=1"
                className="link link-primary"
              >
                Try the demo
              </Link>{' '}
              or meet a few sample pets on the{' '}
              <Link href="/#meet-pets-heading" className="link link-primary">
                homepage
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
