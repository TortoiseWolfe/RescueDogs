'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ShelterPetService } from '@/services/applications';
import { uploadPetPhoto } from '@/lib/pet-photos/upload';
import { useShelterMembership } from '../../ShelterGate';
import type {
  PetSex,
  PetSize,
  PetSpecies,
  PetStatus,
} from '@/types/applications';

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
  const [ageYears, setAgeYears] = useState('');
  const [size, setSize] = useState<PetSize | ''>('');
  const [status, setStatus] = useState<PetStatus>('available');
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
        age_years: ageYears ? Number(ageYears) : null,
        size: size || null,
        status,
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
        <h2 className="text-xl font-semibold">Add pet</h2>
        <Link href="/shelter/pets" className="btn btn-ghost btn-sm min-h-11">
          Cancel
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
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
            'Save pet'
          )}
        </button>
      </form>
    </div>
  );
}
