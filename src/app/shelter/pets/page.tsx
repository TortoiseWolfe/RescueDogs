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
  const { shelterId, transports, transportStates } = useShelterMembership();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTransport, setSavingTransport] = useState<string | null>(null);

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

  /**
   * Optimistic so ticking down a long list stays responsive; the row snaps back
   * if the write fails, rather than lying about what the adopter will see.
   */
  async function toggleTransportable(pet: Pet, next: boolean) {
    setSavingTransport(pet.id);
    setError(null);
    setPets((current) =>
      current.map((row) =>
        row.id === pet.id ? { ...row, transportable: next } : row
      )
    );
    try {
      const service = new ShelterPetService(supabase);
      await service.updatePet(pet.id, { transportable: next });
    } catch {
      setPets((current) =>
        current.map((row) =>
          row.id === pet.id ? { ...row, transportable: !next } : row
        )
      );
      setError(`Could not update transport for ${pet.name}. Please try again.`);
    } finally {
      setSavingTransport(null);
    }
  }

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

  if (error && pets.length === 0) {
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
          Add Pet
        </Link>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      {transports ? (
        <p className="text-base-content/70 text-sm">
          Your rescue transports to {transportStates.length}{' '}
          {transportStates.length === 1 ? 'state' : 'states'}. Every pet below
          is offered for transport unless you untick it.{' '}
          <Link href="/shelter/settings" className="link link-primary">
            Transport settings
          </Link>
        </p>
      ) : null}

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
                {transports ? (
                  <label
                    className="label mt-2 flex min-h-11 cursor-pointer items-center justify-start gap-2 p-0 whitespace-normal"
                    htmlFor={`transportable-${pet.id}`}
                  >
                    <input
                      id={`transportable-${pet.id}`}
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={pet.transportable !== false}
                      disabled={savingTransport === pet.id}
                      onChange={(e) =>
                        void toggleTransportable(pet, e.target.checked)
                      }
                    />
                    <span className="label-text text-sm">
                      Available for transport
                    </span>
                  </label>
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
