'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getInternalUrl } from '@/config/project.config';
import { supabase } from '@/lib/supabase/client';
import { ShelterPetService } from '@/services/applications';
import { useShelterMembership } from '../../ShelterGate';
import type { PetSex, PetSize, PetSpecies } from '@/types/applications';
import { combineAgeYears } from '@/lib/pet-age';
import { normalizePetVideoUrl } from '@/lib/pet-video-url';
import { withAsyncTimeout } from '@/lib/with-timeout';
import { PET_SEX_OPTIONS } from '@/lib/pet-sex';
import { PetAgeFields } from '../PetAgeFields';
import {
  PetPhotoManager,
  type PetPhotoManagerHandle,
} from '../PetPhotoManager';
import { useFormDraft } from '@/hooks/useFormDraft';
import { DraftNotice } from '../DraftNotice';
import { clearStagedPhotos } from '@/lib/pet-photos/staged-draft';

/** The user-entered half of this form. Transient UI state is deliberately excluded. */
interface PetDraft {
  name: string;
  species: PetSpecies;
  breed: string;
  sex: PetSex | '';
  ageYearsPart: number;
  ageMonthsPart: number;
  size: PetSize | '';
  notes: string;
  videoUrl: string;
}

/**
 * Create a pet for the staff member's shelter (#110).
 */
export default function NewShelterPetPage() {
  const { shelterId } = useShelterMembership();
  const router = useRouter();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<PetSex | ''>('');
  const [ageYearsPart, setAgeYearsPart] = useState(0);
  const [ageMonthsPart, setAgeMonthsPart] = useState(0);
  const [size, setSize] = useState<PetSize | ''>('');
  const [notes, setNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoManagerRef = useRef<PetPhotoManagerHandle>(null);
  const hardNavTimerRef = useRef<number | null>(null);
  const busy = saving || redirecting;

  // #310: leaving this page to fetch a photo, a bio or medical details used to throw
  // away everything already typed. Keyed by shelter so two rescues sharing a browser
  // never see each other's half-finished listing.
  const draftValue: PetDraft = {
    name,
    species,
    breed,
    sex,
    ageYearsPart,
    ageMonthsPart,
    size,
    notes,
    videoUrl,
  };
  const { restored, savedAt, clearDraft } = useFormDraft(
    `shelter:${shelterId}:pet:new`,
    draftValue
  );
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const appliedDraft = useRef(false);

  // Apply the restored draft exactly once. `restored` is a one-shot handoff, so this
  // cannot fight the user's own typing on later renders.
  useEffect(() => {
    if (!restored || appliedDraft.current) return;
    appliedDraft.current = true;
    setName(restored.name ?? '');
    setSpecies(restored.species ?? 'dog');
    setBreed(restored.breed ?? '');
    setSex(restored.sex ?? '');
    setAgeYearsPart(restored.ageYearsPart ?? 0);
    setAgeMonthsPart(restored.ageMonthsPart ?? 0);
    setSize(restored.size ?? '');
    setNotes(restored.notes ?? '');
    setVideoUrl(restored.videoUrl ?? '');
    setRestoredFromDraft(true);
  }, [restored]);

  useEffect(() => {
    return () => {
      if (hardNavTimerRef.current !== null) {
        clearTimeout(hardNavTimerRef.current);
      }
    };
  }, []);

  function scheduleHardNav(path: string) {
    if (hardNavTimerRef.current !== null) {
      clearTimeout(hardNavTimerRef.current);
    }
    hardNavTimerRef.current = window.setTimeout(() => {
      window.location.assign(getInternalUrl(path));
    }, 800);
  }

  function goToPetsList() {
    router.push('/shelter/pets');
    scheduleHardNav('/shelter/pets');
  }

  function goToEditPet(petId: string) {
    const path = `/shelter/pets/edit?id=${petId}`;
    router.push(path);
    scheduleHardNav(path);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setRedirecting(false);
    setError(null);
    try {
      const normalizedVideo = normalizePetVideoUrl(videoUrl);
      const service = new ShelterPetService(supabase);
      const pet = await withAsyncTimeout(
        service.createPet(shelterId, {
          name,
          species,
          breed: breed || null,
          sex: sex || null,
          age_years: combineAgeYears(ageYearsPart, ageMonthsPart),
          size: size || null,
          notes: notes || null,
          video_url: normalizedVideo,
        }),
        30_000,
        'Save pet'
      );

      if (photoManagerRef.current?.hasStagedPhotos()) {
        try {
          await photoManagerRef.current.uploadStaged(pet.id);
        } catch (photoErr) {
          setError(
            `Pet saved, but photos failed: ${
              photoErr instanceof Error ? photoErr.message : 'upload error'
            }. You can edit to retry.`
          );
          // The pet row exists, so the typed fields are now on the server and the
          // draft would only resurrect them as a duplicate. The photos must go too:
          // this key is shared by every new listing, so anything left behind would
          // reappear attached to the NEXT pet the rescue adds.
          clearDraft();
          void clearStagedPhotos(`shelter:${shelterId}:pet:new`);
          setRedirecting(true);
          goToEditPet(pet.id);
          return;
        }
      }

      clearDraft();
      setRedirecting(true);
      goToPetsList();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save pet. Try again.'
      );
      setSaving(false);
      setRedirecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Add Pet</h2>
        <Link href="/shelter/pets" className="btn btn-ghost btn-sm min-h-11">
          Cancel
        </Link>
      </div>

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

        <PetPhotoManager
          ref={photoManagerRef}
          shelterId={shelterId}
          petId={null}
          disabled={busy}
          draftKey={`shelter:${shelterId}:pet:new`}
        />

        {error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <DraftNotice
          savedAt={savedAt}
          restored={restoredFromDraft}
          onDiscard={() => {
            clearDraft();
            // The photos are half the draft. Clearing only the STORED rows left the
            // images on screen, and the save effect wrote them straight back — the
            // discard undid itself. clearStaged drops both.
            void photoManagerRef.current?.clearStaged();
            setRestoredFromDraft(false);
            setName('');
            setSpecies('dog');
            setBreed('');
            setSex('');
            setAgeYearsPart(0);
            setAgeMonthsPart(0);
            setSize('');
            setNotes('');
            setVideoUrl('');
          }}
        />

        <button
          type="submit"
          className={`btn btn-primary min-h-11${busy ? 'loading' : ''}`}
          disabled={busy}
        >
          {redirecting ? 'Redirecting…' : saving ? 'Saving…' : 'Save Pet'}
        </button>
      </form>
    </div>
  );
}
