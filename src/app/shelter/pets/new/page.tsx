'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ShelterPetService } from '@/services/applications';
import { uploadPetPhoto } from '@/lib/pet-photos/upload';
import { useShelterMembership } from '../../ShelterGate';
import type { PetSex, PetSize, PetSpecies } from '@/types/applications';
import { combineAgeYears } from '@/lib/pet-age';
import { PetAgeFields } from '../PetAgeFields';

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
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const service = new ShelterPetService(supabase);
      const pet = await service.createPet(shelterId, {
        name,
        species,
        breed: breed || null,
        sex: sex || null,
        age_years: combineAgeYears(ageYearsPart, ageMonthsPart),
        size: size || null,
        notes: notes || null,
      });

      if (file) {
        const uploaded = await uploadPetPhoto(shelterId, pet.id, file);
        if (uploaded.error) {
          setError(
            `Pet saved, but photo failed: ${uploaded.error}. You can edit to retry.`
          );
          setSaving(false);
          router.push(`/shelter/pets/edit?id=${pet.id}`);
          return;
        }
        await service.updatePet(pet.id, { photo_url: uploaded.url });
      }

      router.push('/shelter/pets');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save pet. Try again.'
      );
      setSaving(false);
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
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          <div className="form-control w-full">
            <span className="label-text">Age (optional)</span>
            <PetAgeFields
              years={ageYearsPart}
              months={ageMonthsPart}
              onYearsChange={setAgeYearsPart}
              onMonthsChange={setAgeMonthsPart}
            />
          </div>
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
          <span className="label-text">Notes (optional)</span>
          <textarea
            className="textarea textarea-bordered min-h-24 w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="e.g. Good with kids; needs a quiet home and daily walks."
          />
        </label>

        <label className="form-control w-full">
          <span className="label-text">
            Photo (JPEG, PNG, or WebP, max 5MB)
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="file-input file-input-bordered min-h-11 w-full"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary min-h-11"
          disabled={saving}
        >
          {saving ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'Save Pet'
          )}
        </button>
      </form>
    </div>
  );
}
