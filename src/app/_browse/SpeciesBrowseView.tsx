'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import type { BrowsePet, PetSpecies } from '@/types/applications';
import {
  BROWSE_RADIUS_OPTIONS,
  filterBrowsePetsByRadius,
} from '@/lib/browse/distance';
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
    speciesLabel: string;
    emoji: string;
    description: string;
    emptyHeading: string;
    emptyBody: string;
    listHeading: string;
    petNoun: string;
  }
> = {
  dogs: {
    speciesLabel: 'Dogs',
    emoji: '🐶',
    description:
      'Meet dogs available for adoption from partner shelters and rescues on Raised Paws.',
    emptyHeading: 'No dogs listed yet',
    emptyBody:
      'When shelters and rescues add available dogs, you will find them here.',
    listHeading: 'Dogs available now',
    petNoun: 'dog',
  },
  cats: {
    speciesLabel: 'Cats',
    emoji: '🐱',
    description:
      'Meet cats available for adoption from partner shelters and rescues on Raised Paws.',
    emptyHeading: 'No cats listed yet',
    emptyBody:
      'When shelters and rescues add available cats, you will find them here.',
    listHeading: 'Cats available now',
    petNoun: 'cat',
  },
};

function SpeciesBrowseContent({ species }: { species: SpeciesBrowseKind }) {
  const copy = COPY[species];
  const dbSpecies = SPECIES_DB[species];
  const router = useRouter();
  const pathname = usePathname();

  const [pets, setPets] = useState<BrowsePet[]>([]);
  const [shelterOptions, setShelterOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [draftShelterId, setDraftShelterId] = useState('');
  const [draftState, setDraftState] = useState('');
  const [draftCenterZip, setDraftCenterZip] = useState('');
  const [draftMaxMiles, setDraftMaxMiles] = useState<number | ''>('');
  const [filters, setFilters] = useState<BrowseLocationFilters>({});
  const [urlSynced, setUrlSynced] = useState(false);
  const filtersActive = hasBrowseLocationFilters(filters);

  const normalizedFilters = normalizeBrowseLocationFilters(filters);
  const shelterName = normalizedFilters.shelterId
    ? (shelterOptions.find((s) => s.id === normalizedFilters.shelterId)?.name ??
      pets[0]?.shelters?.name?.trim() ??
      null)
    : null;

  const handleUrlParams = useCallback((urlFilters: BrowseLocationFilters) => {
    const normalized = normalizeBrowseLocationFilters(urlFilters);
    setFilters(normalized);
    setDraftShelterId(normalized.shelterId ?? '');
    setDraftState(normalized.state ?? '');
    setDraftCenterZip(normalized.centerZip ?? '');
    setDraftMaxMiles(normalized.maxMiles ?? '');
    setUrlSynced(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const service = new ApplicationService(supabase);
        const options = await service.listBrowseShelters(dbSpecies);
        if (!cancelled) setShelterOptions(options);
      } catch {
        if (!cancelled) setShelterOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbSpecies]);

  useEffect(() => {
    if (!urlSynced) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const service = new ApplicationService(supabase);
        let rows = await service.getBrowsePets(dbSpecies, filters);
        const normalized = normalizeBrowseLocationFilters(filters);
        if (normalized.centerZip && normalized.maxMiles) {
          rows = filterBrowsePetsByRadius(
            rows,
            normalized.centerZip,
            normalized.maxMiles
          );
        }
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

  function syncFiltersToUrl(next: BrowseLocationFilters) {
    const normalized = normalizeBrowseLocationFilters(next);
    const params = new URLSearchParams();
    if (normalized.shelterId) params.set('shelter', normalized.shelterId);
    if (normalized.state) params.set('state', normalized.state);
    if (normalized.centerZip) params.set('zip', normalized.centerZip);
    if (normalized.maxMiles) params.set('miles', String(normalized.maxMiles));
    const query = params.toString();
    router.replace(query ? `${pathname ?? ''}?${query}` : (pathname ?? ''));
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setFilterError(null);

    if (draftMaxMiles && !draftCenterZip.trim()) {
      setFilterError('Enter your ZIP code to filter by distance.');
      return;
    }

    const next: BrowseLocationFilters = {
      ...(draftShelterId ? { shelterId: draftShelterId } : {}),
      ...(draftState ? { state: draftState } : {}),
      ...(draftCenterZip.trim() ? { centerZip: draftCenterZip } : {}),
      ...(draftMaxMiles ? { maxMiles: draftMaxMiles } : {}),
    };
    setFilters(next);
    syncFiltersToUrl(next);
  }

  function clearFilters() {
    setDraftShelterId('');
    setDraftState('');
    setDraftCenterZip('');
    setDraftMaxMiles('');
    setFilterError(null);
    setFilters({});
    router.replace(pathname ?? '');
  }

  const listTitle = shelterName
    ? `${copy.speciesLabel} at ${shelterName}`
    : copy.listHeading;

  return (
    <>
      <BrowseSearchParamsReader onParams={handleUrlParams} />
      <main className="bg-base-100 min-h-full">
        <section className="bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-4 py-5 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center lg:text-left">
            {shelterName ? (
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                <span aria-hidden="true">{copy.emoji} </span>
                {listTitle}
              </h1>
            ) : (
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                <span aria-hidden="true">{copy.emoji} </span>
                Browse{' '}
                <span className="text-[#f97316]">{copy.speciesLabel}</span>
              </h1>
            )}
            <p className="mt-1 hidden text-sm leading-snug text-white/85 sm:block sm:text-base">
              {shelterName
                ? `Available ${copy.petNoun}s from ${shelterName} on Raised Paws.`
                : copy.description}
            </p>
          </div>
        </section>

        <section
          className="border-base-300 bg-base-200 border-b px-4 py-3 sm:px-6 lg:px-8"
          aria-label="Filter pets"
        >
          <form onSubmit={applyFilters} className="mx-auto max-w-6xl">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto_auto] lg:items-end">
              <label className="form-control w-full">
                <span className="label-text mb-1 text-xs font-medium sm:text-sm">
                  Rescue / shelter
                </span>
                <select
                  className="select select-bordered select-sm sm:select-md min-h-11 w-full"
                  value={draftShelterId}
                  onChange={(e) => setDraftShelterId(e.target.value)}
                  aria-label="Rescue or shelter"
                >
                  <option value="">Any rescue</option>
                  {shelterOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text mb-1 text-xs font-medium sm:text-sm">
                  State
                </span>
                <select
                  className="select select-bordered select-sm sm:select-md min-h-11 w-full"
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
                <span className="label-text mb-1 text-xs font-medium sm:text-sm">
                  Your ZIP
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  className="input input-bordered input-sm sm:input-md min-h-11 w-full"
                  placeholder="e.g. 62269"
                  value={draftCenterZip}
                  onChange={(e) => setDraftCenterZip(e.target.value)}
                  aria-label="Your ZIP code"
                  maxLength={20}
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text mb-1 text-xs font-medium sm:text-sm">
                  Distance
                </span>
                <select
                  className="select select-bordered select-sm sm:select-md min-h-11 w-full"
                  value={draftMaxMiles === '' ? '' : String(draftMaxMiles)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftMaxMiles(v === '' ? '' : Number(v));
                  }}
                  aria-label="Maximum distance"
                >
                  {BROWSE_RADIUS_OPTIONS.map((option) => (
                    <option
                      key={option.label}
                      value={option.value === '' ? '' : String(option.value)}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="btn btn-primary btn-sm sm:btn-md min-h-11 w-full lg:w-auto"
              >
                Apply
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm sm:btn-md min-h-11 w-full lg:w-auto"
                onClick={clearFilters}
                disabled={
                  !filtersActive &&
                  !draftShelterId &&
                  !draftState &&
                  !draftCenterZip &&
                  draftMaxMiles === ''
                }
              >
                Clear
              </button>
            </div>
            {filterError && (
              <p role="alert" className="text-error mt-2 text-sm">
                {filterError}
              </p>
            )}
            <p className="text-base-content/60 mt-2 text-xs leading-snug">
              Distance is approximate from your ZIP centroid, not driving miles.
            </p>
          </form>
        </section>

        <section
          className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8"
          aria-labelledby="species-browse-heading"
        >
          <h2 id="species-browse-heading" className="sr-only">
            {listTitle}
          </h2>

          {loading && (
            <div className="flex min-h-[20vh] items-center justify-center">
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
                  Try another rescue, state, or distance, or clear the filters
                  to see every available {copy.petNoun}.
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
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
