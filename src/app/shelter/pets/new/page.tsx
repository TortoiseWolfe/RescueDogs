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
import { withAsyncTimeout } from '@/lib/with-timeout';
import { PET_SEX_OPTIONS } from '@/lib/pet-sex';
import { PetAgeFields } from '../PetAgeFields';
import {
  PetPhotoManager,
  type PetPhotoManagerHandle,
} from '../PetPhotoManager';

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
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoManagerRef = useRef<PetPhotoManagerHandle>(null);
  const hardNavTimerRef = useRef<number | null>(null);
  const busy = saving || redirecting;

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
          setRedirecting(true);
          goToEditPet(pet.id);
          return;
        }
      }

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

        <PetPhotoManager
          ref={photoManagerRef}
          shelterId={shelterId}
          petId={null}
          disabled={busy}
        />

        {error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

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
