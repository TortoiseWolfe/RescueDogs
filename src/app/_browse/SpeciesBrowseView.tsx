'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import type { BrowsePet, PetSpecies } from '@/types/applications';
import {
  hasBrowseLocationFilters,
  normalizeBrowseLocationFilters,
  US_STATE_OPTIONS,
  type BrowseLocationFilters,
} from '@/lib/browse/location-filters';
import { petDetailPath } from '@/lib/browse/pet-links';
import { basicsLabel, locationLabel } from './browse-labels';
import BrowseSearchParamsReader from './BrowseSearchParamsReader';

export type SpeciesBrowseKind = 'dogs' | 'cats';

const SPECIES_DB: Record<SpeciesBrowseKind, PetSpecies> = {
  dogs: 'dog',
  cats: 'cat',
};

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
    listHeading: string;
    petNoun: string;
  }
> = {
  dogs: {
    title: 'Browse dogs',
    emoji: '🐶',
    description:
      'Meet dogs available for adoption from partner shelters and rescues on Raised Paws.',
    emptyHeading: 'No dogs listed yet',
    emptyBody:
      'When shelters and rescues add available dogs, you will find them here. Trait filters are coming later.',
    otherHref: '/cats',
    otherLabel: 'Browse cats',
    listHeading: 'Dogs available now',
    petNoun: 'dog',
  },
  cats: {
    title: 'Browse cats',
    emoji: '🐱',
    description:
      'Meet cats available for adoption from partner shelters and rescues on Raised Paws.',
    emptyHeading: 'No cats listed yet',
    emptyBody:
      'When shelters and rescues add available cats, you will find them here. Trait filters are coming later.',
    otherHref: '/dogs',
    otherLabel: 'Browse dogs',
    listHeading: 'Cats available now',
    petNoun: 'cat',
  },
};

const heroCtaClassName =
  'btn btn-lg min-h-11 border-0 bg-white px-8 font-bold text-[#1e3a8a] hover:bg-[#e8edf7]';

function SpeciesBrowseContent({ species }: { species: SpeciesBrowseKind }) {
  const copy = COPY[species];
  const dbSpecies = SPECIES_DB[species];
  const [pets, setPets] = useState<BrowsePet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftState, setDraftState] = useState('');
  const [draftZip, setDraftZip] = useState('');
  const [filters, setFilters] = useState<BrowseLocationFilters>({});
  const [urlSynced, setUrlSynced] = useState(false);
  const filtersActive = hasBrowseLocationFilters(filters);
  const shelterFilterActive = Boolean(
    normalizeBrowseLocationFilters(filters).shelterId
  );
  const shelterName =
    shelterFilterActive && pets[0]?.shelters?.name?.trim()
      ? pets[0].shelters.name.trim()
      : null;

  const handleUrlParams = useCallback((urlFilters: BrowseLocationFilters) => {
    const normalized = normalizeBrowseLocationFilters(urlFilters);
    setFilters(normalized);
    setDraftState(normalized.state ?? '');
    setDraftZip(normalized.zip ?? '');
    setUrlSynced(true);
  }, []);

  useEffect(() => {
    if (!urlSynced) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const service = new ApplicationService(supabase);
        const rows = await service.getBrowsePets(dbSpecies, filters);
        if (cancelled) return;
        setPets(rows);
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Could not load pets. Please try again.');
          setPets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbSpecies, filters, urlSynced]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setFilters({
      ...normalizeBrowseLocationFilters(filters),
      state: draftState,
      zip: draftZip,
    });
  }

  function clearFilters() {
    setDraftState('');
    setDraftZip('');
    setFilters(
      normalizeBrowseLocationFilters(filters).shelterId
        ? { shelterId: normalizeBrowseLocationFilters(filters).shelterId }
        : {}
    );
  }

  const listTitle = shelterName
    ? `${copy.petNoun === 'dog' ? 'Dogs' : 'Cats'} at ${shelterName}`
    : copy.listHeading;

  return (
    <>
      <BrowseSearchParamsReader onParams={handleUrlParams} />
      <main className="bg-base-100 min-h-full">
        <section className="bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-3xl text-center lg:text-left">
            <p className="font-friendly text-sm font-bold tracking-wide text-[#f97316] uppercase">
              Browse pets
            </p>
            <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              <span aria-hidden="true">{copy.emoji} </span>
              {shelterName ? listTitle : copy.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/90 sm:text-xl">
              {shelterName
                ? `Available ${copy.petNoun}s from ${shelterName} on Raised Paws.`
                : copy.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={copy.otherHref} className={heroCtaClassName}>
                {copy.otherLabel}
              </Link>
              <Link href="/adopt" className={heroCtaClassName}>
                Apply to Adopt
              </Link>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
          aria-labelledby="species-browse-heading"
        >
          <h2 id="species-browse-heading" className="sr-only">
            {listTitle}
          </h2>

          {shelterFilterActive && (
            <p className="text-base-content/80 mb-6 text-sm">
              Showing pets from one rescue.{' '}
              <Link
                href={species === 'dogs' ? '/dogs' : '/cats'}
                className="link link-primary"
              >
                Browse all {species}
              </Link>
            </p>
          )}

          <form
            onSubmit={applyFilters}
            className="bg-base-200 rounded-box mb-8 p-4"
            aria-label="Filter by shelter location"
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <label className="form-control w-full">
                <span className="label-text mb-1 font-medium">State</span>
                <select
                  className="select select-bordered min-h-11 w-full"
                  value={draftState}
                  onChange={(e) => setDraftState(e.target.value)}
                  aria-label="Shelter state"
                >
                  <option value="">Any state</option>
                  {US_STATE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name} ({option.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text mb-1 font-medium">ZIP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  className="input input-bordered min-h-11 w-full"
                  placeholder="Exact ZIP"
                  value={draftZip}
                  onChange={(e) => setDraftZip(e.target.value)}
                  aria-label="Shelter ZIP code"
                  maxLength={20}
                />
              </label>
              <button type="submit" className="btn btn-primary min-h-11">
                Apply filters
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-11"
                onClick={clearFilters}
                disabled={
                  !filtersActive &&
                  !draftState &&
                  !draftZip &&
                  !shelterFilterActive
                }
              >
                Clear
              </button>
            </div>
            <p className="text-base-content/70 mt-3 text-sm">
              Matches the shelter&apos;s state and ZIP exactly — not a radius
              search.
            </p>
          </form>

          {loading && (
            <div className="flex min-h-[30vh] items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && pets.length === 0 && filtersActive && (
            <div className="card bg-base-200">
              <div className="card-body items-center gap-4 text-center">
                <h2 className="font-display card-title text-2xl">
                  No pets match these filters
                </h2>
                <p className="text-base-content/80 max-w-md">
                  Try another state or ZIP, or clear the filters to see every
                  available {copy.petNoun}.
                </p>
                <button
                  type="button"
                  className="btn btn-primary min-h-11"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}

          {!loading && !error && pets.length === 0 && !filtersActive && (
            <div className="card bg-base-200">
              <div className="card-body items-center gap-4 text-center">
                <h2 className="font-display card-title text-2xl">
                  {copy.emptyHeading}
                </h2>
                <p className="text-base-content/80 max-w-md">
                  {copy.emptyBody}
                </p>
                <p className="text-base-content/70 max-w-md text-sm">
                  Prefer a guided tour with demo data?{' '}
                  <Link
                    href="/get-started?demo=1&choose=1"
                    className="link link-primary"
                  >
                    Try the demo
                  </Link>{' '}
                  or meet a few sample pets on the{' '}
                  <Link
                    href="/#meet-pets-heading"
                    className="link link-primary"
                  >
                    homepage
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          {!loading && !error && pets.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {pets.map((pet) => {
                const place = locationLabel(pet);
                const detailHref = petDetailPath(dbSpecies, pet.id);
                return (
                  <li key={pet.id}>
                    <article className="card bg-base-200 h-full shadow-sm">
                      <Link href={detailHref} className="block">
                        <figure className="bg-base-300 aspect-[4/3] overflow-hidden">
                          {pet.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pet.photo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div
                              className="text-base-content/40 flex h-full w-full items-center justify-center text-sm"
                              aria-hidden
                            >
                              No photo yet
                            </div>
                          )}
                        </figure>
                      </Link>
                      <div className="card-body gap-3">
                        <h3 className="card-title font-display text-xl">
                          <Link href={detailHref} className="link link-hover">
                            {pet.name}
                          </Link>
                        </h3>
                        <p className="text-base-content/80 text-sm">
                          {basicsLabel(pet)}
                        </p>
                        {pet.notes?.trim() ? (
                          <p className="text-base-content/70 line-clamp-3 text-sm leading-relaxed">
                            {pet.notes.trim()}
                          </p>
                        ) : null}
                        {place && (
                          <p className="text-base-content/60 text-sm">
                            {place}
                          </p>
                        )}
                        <div className="card-actions mt-auto">
                          <Link
                            href={detailHref}
                            className="btn btn-primary min-h-11 w-full sm:w-auto"
                          >
                            Meet {pet.name}
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

/**
 * Shared browse chrome for /dogs and /cats (#112 / #111).
 * Lists available pets from Supabase; filters by shelter state/ZIP.
 */
export default function SpeciesBrowseView({
  species,
}: {
  species: SpeciesBrowseKind;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <SpeciesBrowseContent species={species} />
    </Suspense>
  );
}
