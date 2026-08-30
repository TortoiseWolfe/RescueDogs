'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import type { BrowsePetDetail, PetSpecies } from '@/types/applications';
import { formatPetAgeLabel } from '@/lib/pet-age';
import { formatPetSexLabel } from '@/lib/pet-sex';
import { petDetailPath, speciesBrowsePath } from '@/lib/browse/pet-links';
import { locationLabel } from './browse-labels';
import PetDetailSearchParamsReader from './PetDetailSearchParamsReader';
import type { SpeciesBrowseKind } from './SpeciesBrowseView';

const COPY: Record<
  SpeciesBrowseKind,
  { backHref: string; backLabel: string; emoji: string }
> = {
  dogs: {
    backHref: '/dogs',
    backLabel: 'Browse dogs',
    emoji: '🐶',
  },
  cats: {
    backHref: '/cats',
    backLabel: 'Browse cats',
    emoji: '🐱',
  },
};

function galleryUrls(pet: BrowsePetDetail): string[] {
  const fromGallery = (pet.pet_photos ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => row.url)
    .filter(Boolean);
  if (fromGallery.length > 0) return fromGallery;
  if (pet.photo_url) return [pet.photo_url];
  return [];
}

function traitsLine(pet: BrowsePetDetail): string {
  const parts = [
    pet.breed,
    formatPetSexLabel(pet.sex),
    pet.size,
    formatPetAgeLabel(pet.age_years),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Details coming soon';
}

function PetDetailContent({ species }: { species: SpeciesBrowseKind }) {
  const copy = COPY[species];
  const dbSpecies: PetSpecies = species === 'dogs' ? 'dog' : 'cat';

  const [petId, setPetId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [pet, setPet] = useState<BrowsePetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleParams = useCallback((id: string | null) => {
    setPetId(id);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!petId) {
      setError('Missing pet id.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const service = new ApplicationService(supabase);
        const row = await service.getBrowsePet(petId);
        if (cancelled) return;
        if (!row || row.species !== dbSpecies) {
          setPet(null);
          setError(null);
        } else {
          setPet(row);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this pet. Please try again.');
          setPet(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialized, petId, dbSpecies]);

  useEffect(() => {
    if (!pet) return;
    const shelter = pet.shelters?.name?.trim();
    const previous = document.title;
    document.title = shelter
      ? `${pet.name} · ${shelter} | Raised Paws`
      : `${pet.name} | Raised Paws`;
    return () => {
      document.title = previous;
    };
  }, [pet]);

  if (!initialized || loading) {
    return (
      <>
        <PetDetailSearchParamsReader onParams={handleParams} />
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </>
    );
  }

  if (!petId || !pet) {
    return (
      <>
        <PetDetailSearchParamsReader onParams={handleParams} />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href={copy.backHref}
            className="link link-hover mb-6 inline-block text-sm"
          >
            ← {copy.backLabel}
          </Link>
          <div role="alert" className="alert">
            <span>
              {error ??
                'This pet is not available for adoption right now. It may have been adopted or the link may be outdated.'}
            </span>
            <Link href={copy.backHref} className="btn btn-sm min-h-11">
              {copy.backLabel}
            </Link>
          </div>
        </main>
      </>
    );
  }

  const photos = galleryUrls(pet);
  const place = locationLabel(pet);
  const shelterName = pet.shelters?.name?.trim() ?? null;
  const shelterListingHref = speciesBrowsePath(dbSpecies, pet.shelter_id);

  return (
    <>
      <PetDetailSearchParamsReader onParams={handleParams} />
      <main className="bg-base-100 min-h-full">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={copy.backHref}
            className="link link-hover mb-6 inline-block text-sm"
          >
            ← {copy.backLabel}
          </Link>

          <header className="mb-6">
            <p className="font-friendly text-sm font-bold tracking-wide text-[#f97316] uppercase">
              <span aria-hidden="true">{copy.emoji} </span>
              Available for adoption
            </p>
            <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {pet.name}
            </h1>
            <p className="text-base-content/80 mt-2 text-lg">
              {traitsLine(pet)}
            </p>
            {shelterName && (
              <p className="text-base-content/70 mt-2 text-sm">
                From{' '}
                <Link href={shelterListingHref} className="link link-primary">
                  {shelterName}
                </Link>
                {place ? ` · ${place}` : ''}
              </p>
            )}
          </header>

          {photos.length > 0 ? (
            <div
              className={
                photos.length === 1 ? 'mb-8' : 'mb-8 grid gap-3 sm:grid-cols-2'
              }
            >
              {photos.map((url, index) => (
                <figure
                  key={`${url}-${index}`}
                  className="bg-base-200 overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div
              className="bg-base-200 text-base-content/50 mb-8 flex aspect-[4/3] items-center justify-center rounded-xl text-sm"
              aria-hidden
            >
              No photo yet
            </div>
          )}

          {pet.notes?.trim() ? (
            <section className="mb-8" aria-labelledby="pet-story-heading">
              <h2
                id="pet-story-heading"
                className="font-display text-2xl font-bold"
              >
                About {pet.name}
              </h2>
              <p className="text-base-content/80 mt-3 leading-relaxed">
                {pet.notes.trim()}
              </p>
            </section>
          ) : null}

          <div className="border-base-300 bg-base-200 sticky bottom-0 -mx-4 border-t px-4 py-4 sm:static sm:mx-0 sm:rounded-xl sm:border sm:px-6">
            <Link
              href={`/adopt?pet=${pet.id}`}
              className="btn btn-primary min-h-11 w-full text-base font-semibold"
            >
              Apply to Adopt {pet.name}
            </Link>
            <p className="text-base-content/60 mt-2 text-center text-xs sm:text-sm">
              You&apos;ll complete one universal application — no duplicate
              forms for every pet.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * Public pet detail for /dogs/detail and /cats/detail (#274).
 */
export default function PetDetailView({
  species,
}: {
  species: SpeciesBrowseKind;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <PetDetailContent species={species} />
    </Suspense>
  );
}
