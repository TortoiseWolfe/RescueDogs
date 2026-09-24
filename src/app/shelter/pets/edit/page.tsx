'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ShelterPetService } from '@/services/applications';
import { PetPhotoService } from '@/services/applications/pet-photo-service';
import { combineAgeYears, splitAgeYears } from '@/lib/pet-age';
import { normalizePetVideoUrl } from '@/lib/pet-video-url';
import { PET_SEX_OPTIONS } from '@/lib/pet-sex';
import { useShelterMembership } from '../../ShelterGate';
import { PetAgeFields } from '../PetAgeFields';
import { PetPhotoManager } from '../PetPhotoManager';
import { PetTransportField } from '../PetTransportField';
import type {
  Pet,
  PetPhoto,
  PetSex,
  PetSize,
  PetSpecies,
  PetStatus,
} from '@/types/applications';
import SearchParamsReader from './SearchParamsReader';
import { useFormDraft } from '@/hooks/useFormDraft';

/**
 * Edit an existing shelter pet + optional new photo (#110).
 * Uses ?id= (not a dynamic segment) for GitHub Pages static export.
 */
function EditShelterPetContent() {
  const { shelterId, transports, transportStates } = useShelterMembership();
  const router = useRouter();

  const [petId, setPetId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [pet, setPet] = useState<Pet | null>(null);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<PetSex | ''>('');
  const [ageYearsPart, setAgeYearsPart] = useState(0);
  const [ageMonthsPart, setAgeMonthsPart] = useState(0);
  const [size, setSize] = useState<PetSize | ''>('');
  const [status, setStatus] = useState<PetStatus>('available');
  const [notes, setNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [transportable, setTransportable] = useState(true);
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applicationCount, setApplicationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * #310: a draft here must NOT silently win.
   *
   * Unlike Add Pet, this form has a server row behind it. Auto-applying a stored
   * draft would present stale local text as if it were saved, and the user would have
   * no way to tell which they were looking at. So the draft is offered, not applied.
   *
   * `enabled` waits for the load: the pet id arrives from ?id= after mount (static
   * export has no dynamic segment), and persisting before hydration would capture the
   * empty form and overwrite a real draft with blanks.
   */
  const draftReady = !loading && Boolean(petId) && Boolean(pet);
  const draftValue = {
    name,
    species,
    breed,
    sex,
    ageYearsPart,
    ageMonthsPart,
    size,
    status,
    notes,
    videoUrl,
    transportable,
  };
  const {
    restored: pendingDraft,
    savedAt: draftSavedAt,
    clearDraft,
  } = useFormDraft(
    `shelter:${shelterId}:pet:${petId ?? 'pending'}`,
    draftValue,
    {
      enabled: draftReady,
    }
  );

  const [draftDismissed, setDraftDismissed] = useState(false);

  // Only worth offering if it actually differs from what the server returned —
  // otherwise the prompt is noise about changes that are already saved.
  const draftDiffers =
    pendingDraft !== null &&
    JSON.stringify(pendingDraft) !== JSON.stringify(draftValue);
  const offerDraft = draftReady && draftDiffers && !draftDismissed;

  function applyDraft() {
    if (!pendingDraft) return;
    setName(pendingDraft.name ?? '');
    setSpecies(pendingDraft.species ?? 'dog');
    setBreed(pendingDraft.breed ?? '');
    setSex(pendingDraft.sex ?? '');
    setAgeYearsPart(pendingDraft.ageYearsPart ?? 0);
    setAgeMonthsPart(pendingDraft.ageMonthsPart ?? 0);
    setSize(pendingDraft.size ?? '');
    setStatus(pendingDraft.status ?? 'available');
    setNotes(pendingDraft.notes ?? '');
    setVideoUrl(pendingDraft.videoUrl ?? '');
    setTransportable(pendingDraft.transportable ?? true);
    setDraftDismissed(true);
  }

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
      try {
        const service = new ShelterPetService(supabase);
        const photoService = new PetPhotoService(supabase);
        const [row, appCount, petPhotos] = await Promise.all([
          service.getPet(petId),
          service.getPetApplicationCount(petId),
          photoService.listPhotos(petId),
        ]);
        if (cancelled) return;
        if (!row || row.shelter_id !== shelterId) {
          setError('Pet not found for this shelter.');
          setLoading(false);
          return;
        }
        setPet(row);
        setApplicationCount(appCount);
        setName(row.name);
        setSpecies(row.species);
        setBreed(row.breed ?? '');
        setSex(row.sex ?? '');
        const ageParts = splitAgeYears(row.age_years);
        setAgeYearsPart(ageParts?.years ?? 0);
        setAgeMonthsPart(ageParts?.months ?? 0);
        setSize(row.size ?? '');
        setStatus(row.status);
        setNotes(row.notes ?? '');
        setVideoUrl(row.video_url ?? '');
        setTransportable(row.transportable !== false);
        setPhotos(petPhotos);
      } catch {
        if (!cancelled) setError('Could not load pet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialized, petId, shelterId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pet || !name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const normalizedVideo = normalizePetVideoUrl(videoUrl);
      const service = new ShelterPetService(supabase);
      await service.updatePet(pet.id, {
        name,
        species,
        breed: breed || null,
        sex: sex || null,
        age_years: combineAgeYears(ageYearsPart, ageMonthsPart),
        size: size || null,
        status,
        notes: notes || null,
        video_url: normalizedVideo,
        transportable,
      });

      clearDraft();
      router.push('/shelter/pets');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update pet. Try again.'
      );
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!pet || applicationCount > 0) return;
    const ok = window.confirm(`Delete ${pet.name}? This cannot be undone.`);
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      const service = new ShelterPetService(supabase);
      await service.deletePet(pet.id);
      router.push('/shelter/pets');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete pet. Try again.'
      );
      setDeleting(false);
    }
  }

  return (
    <>
      <SearchParamsReader onParams={handleParams} />
      {!initialized || loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : !pet ? (
        <div role="alert" className="alert alert-error">
          <span>{error ?? 'Pet not found.'}</span>
          <Link href="/shelter/pets" className="btn btn-sm">
            Back to Pets
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Edit {pet.name}</h2>
            <Link
              href="/shelter/pets"
              className="btn btn-ghost btn-sm min-h-11"
            >
              Cancel
            </Link>
          </div>

          <PetPhotoManager
            shelterId={shelterId}
            petId={pet.id}
            initialPhotos={photos}
            legacyPhotoUrl={pet.photo_url}
            disabled={saving || deleting}
          />

          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <label className="form-control w-full">
              <span className="label-text">Name</span>
              <input
                className="input input-bordered min-h-11 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text">Species</span>
              <select
                className="select select-bordered min-h-11 w-full"
                value={species}
                onChange={(e) => setSpecies(e.target.value as PetSpecies)}
              >
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
              </select>
            </label>

            <label className="form-control w-full">
              <span className="label-text">Breed (optional)</span>
              <input
                className="input input-bordered min-h-11 w-full"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                maxLength={100}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="form-control w-full">
                <span className="label-text">Sex</span>
                <select
                  className="select select-bordered min-h-11 w-full"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as PetSex | '')}
                >
                  <option value="">Unknown</option>
                  {PET_SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <PetAgeFields
                years={ageYearsPart}
                months={ageMonthsPart}
                onYearsChange={setAgeYearsPart}
                onMonthsChange={setAgeMonthsPart}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="form-control w-full">
                <span className="label-text">Size</span>
                <select
                  className="select select-bordered min-h-11 w-full"
                  value={size}
                  onChange={(e) => setSize(e.target.value as PetSize | '')}
                >
                  <option value="">Unknown</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>

              <label className="form-control w-full">
                <span className="label-text">Status</span>
                <select
                  className="select select-bordered min-h-11 w-full"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PetStatus)}
                >
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="adopted">Adopted</option>
                </select>
              </label>
            </div>

            <label className="form-control w-full">
              <span className="label-text">Bio (optional)</span>
              <textarea
                className="textarea textarea-bordered min-h-24 w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Share this pet's story — personality, history, and what kind of home they need."
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text">Video link (optional)</span>
              <input
                type="url"
                className="input input-bordered min-h-11 w-full"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                maxLength={2048}
                placeholder="https://www.youtube.com/watch?v=…"
                inputMode="url"
                autoComplete="off"
              />
              <span className="label-text-alt text-base-content/60 mt-1">
                YouTube, TikTok, Vimeo, or any public video URL.
              </span>
            </label>

            <PetTransportField
              transports={transports}
              transportStates={transportStates}
              value={transportable}
              onChange={setTransportable}
              disabled={saving || deleting}
            />

            {error && (
              <div role="alert" className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {offerDraft && draftSavedAt !== null && (
              <div
                role="status"
                className="alert alert-info flex flex-wrap items-center gap-2"
                data-testid="draft-offer"
              >
                <span className="grow">
                  You have unsaved changes to this pet from{' '}
                  <time dateTime={new Date(draftSavedAt).toISOString()}>
                    {new Date(draftSavedAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                  . They have not been saved.
                </span>
                <button
                  type="button"
                  className="btn btn-sm min-h-11"
                  onClick={applyDraft}
                >
                  Restore them
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm min-h-11"
                  onClick={() => {
                    clearDraft();
                    setDraftDismissed(true);
                  }}
                >
                  Discard
                </button>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary min-h-11"
              disabled={saving || deleting}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'Save changes'
              )}
            </button>
          </form>

          <div className="border-base-300 border-t pt-4">
            {applicationCount === 0 ? (
              <button
                type="button"
                className="btn btn-outline btn-error min-h-11 w-full"
                disabled={saving || deleting}
                onClick={() => void onDelete()}
              >
                {deleting ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Delete Pet'
                )}
              </button>
            ) : (
              <p className="text-base-content/80 text-sm">
                This pet has {applicationCount} application
                {applicationCount === 1 ? '' : 's'}, so it can&apos;t be
                deleted. Set status to Adopted to remove it from browse.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function EditShelterPetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <EditShelterPetContent />
    </Suspense>
  );
}
