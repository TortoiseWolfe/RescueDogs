'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ShelterPetService } from '@/services/applications';
import { useShelterMembership } from '../ShelterGate';
import type { Pet } from '@/types/applications';

/**
 * Shelter pets list (#110). Staff manage animals for their membership shelter.
 */
export default function ShelterPetsPage() {
  const { shelterId } = useShelterMembership();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPets = useCallback(async () => {
    try {
      const service = new ShelterPetService(supabase);
      setPets(await service.listPets(shelterId));
      setError(null);
    } catch {
      setError('Could not load pets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error">
        <span>{error}</span>
        <button type="button" className="btn btn-sm" onClick={fetchPets}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Pets</h2>
        <Link href="/shelter/pets/new" className="btn btn-primary min-h-11">
          Add pet
        </Link>
      </div>

      {pets.length === 0 ? (
        <p className="text-base-content/70">
          No pets yet. Add the first animal so adopters can apply.
        </p>
      ) : (
        <ul className="divide-base-300 border-base-300 divide-y rounded-lg border">
          {pets.map((pet) => (
            <li key={pet.id} className="flex flex-wrap items-center gap-4 p-4">
              {pet.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pet.photo_url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="bg-base-200 text-base-content/40 flex h-16 w-16 items-center justify-center rounded-lg text-xs"
                  aria-hidden
                >
                  No photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{pet.name}</p>
                <p className="text-base-content/70 text-sm capitalize">
                  {pet.species}
                  {pet.breed ? ` · ${pet.breed}` : ''} · {pet.status}
                </p>
                {pet.notes?.trim() ? (
                  <p className="text-base-content/60 mt-1 line-clamp-2 text-sm">
                    {pet.notes.trim()}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/shelter/pets/edit?id=${pet.id}`}
                className="btn btn-sm btn-ghost min-h-11"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
