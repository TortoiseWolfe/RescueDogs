'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ShelterPetService } from '@/services/applications';
import { uploadPetPhoto } from '@/lib/pet-photos/upload';
import { useShelterMembership } from '../../ShelterGate';
import type {
  Pet,
  PetSex,
  PetSize,
  PetSpecies,
  PetStatus,
} from '@/types/applications';
import SearchParamsReader from './SearchParamsReader';

/**
 * Edit an existing shelter pet + optional new photo (#110).
 * Uses ?id= (not a dynamic segment) for GitHub Pages static export.
 */
function EditShelterPetContent() {
  const { shelterId } = useShelterMembership();
  const router = useRouter();

  const [petId, setPetId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [pet, setPet] = useState<Pet | null>(null);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<PetSex | ''>('');
  const [ageYears, setAgeYears] = useState('');
  const [size, setSize] = useState<PetSize | ''>('');
  const [status, setStatus] = useState<PetStatus>('available');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applicationCount, setApplicationCount] = useState(0);
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
      try {
        const service = new ShelterPetService(supabase);
        const [row, appCount] = await Promise.all([
          service.getPet(petId),
          service.getPetApplicationCount(petId),
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
        setAgeYears(row.age_years != null ? String(row.age_years) : '');
        setSize(row.size ?? '');
        setStatus(row.status);
        setNotes(row.notes ?? '');
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
      const service = new ShelterPetService(supabase);
      let photoUrl = pet.photo_url;

      if (file) {
        const uploaded = await uploadPetPhoto(shelterId, pet.id, file);
        if (uploaded.error) {
          setError(uploaded.error);
          setSaving(false);
          return;
        }
        photoUrl = uploaded.url;
      }

      await service.updatePet(pet.id, {
        name,
        species,
        breed: breed || null,
        sex: sex || null,
        age_years: ageYears ? Number(ageYears) : null,
        size: size || null,
        status,
        photo_url: photoUrl,
        notes: notes || null,
      });

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

          {pet.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pet.photo_url}
              alt=""
              className="h-40 w-40 rounded-lg object-cover"
            />
          )}

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

              <label className="form-control w-full">
                <span className="label-text">Age (years)</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.5}
                  className="input input-bordered min-h-11 w-full"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                />
              </label>
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
                Replace photo (JPEG, PNG, or WebP, max 5MB)
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
