'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import ApplicationForm from '@/components/forms/ApplicationForm';
import {
  toProfileSnapshot,
  type ApplicationFormData,
} from '@/schemas/application.schema';
import type { AdopterProfile, Pet } from '@/types/applications';
import SearchParamsReader from './SearchParamsReader';

/** Map a saved adopter profile to form default values (nulls → undefined). */
function profileToDefaults(
  profile: AdopterProfile
): Partial<ApplicationFormData> {
  return {
    full_name: profile.full_name,
    phone: profile.phone ?? undefined,
    address_line: profile.address_line ?? undefined,
    city: profile.city ?? undefined,
    state: profile.state ?? undefined,
    zip: profile.zip ?? undefined,
    housing_type: profile.housing_type,
    landlord_approval: profile.landlord_approval ?? undefined,
    landlord_contact: profile.landlord_contact ?? undefined,
    has_yard: profile.has_yard,
    yard_fenced: profile.yard_fenced ?? undefined,
    household_adults: profile.household_adults,
    household_children: profile.household_children,
    other_pets: profile.other_pets ?? undefined,
    vet_name: profile.vet_name ?? undefined,
    vet_phone: profile.vet_phone ?? undefined,
    experience: profile.experience ?? undefined,
  };
}

function AdoptContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [preselectedPetId, setPreselectedPetId] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [defaults, setDefaults] = useState<
    Partial<ApplicationFormData> | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParams = useCallback((petId: string | null) => {
    setPreselectedPetId(petId);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const service = new ApplicationService(supabase);
        const [availablePets, profile] = await Promise.all([
          service.getAvailablePets(),
          service.getAdopterProfile(user.id),
        ]);
        if (cancelled) return;
        setPets(availablePets);
        if (profile) setDefaults(profileToDefaults(profile));
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Could not load adoptable pets. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const handleSubmit = useCallback(
    async (data: ApplicationFormData) => {
      if (!user) return;
      const pet = pets.find((p) => p.id === data.pet_id);
      if (!pet) {
        setError('That pet is no longer available — please pick another.');
        return;
      }
      setSubmitting(true);
      try {
        const service = new ApplicationService(supabase);
        const application = await service.submitApplication(user.id, {
          petId: pet.id,
          shelterId: pet.shelter_id,
          profile: toProfileSnapshot(data),
          whyThisPet: data.why_this_pet,
        });
        router.push(`/applications/status?id=${application.id}`);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        setError(
          code === '23505'
            ? 'You already have an application for this pet — check My Applications for its status.'
            : 'Could not submit your application. Please try again.'
        );
        setSubmitting(false);
      }
    },
    [user, pets, router]
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <SearchParamsReader onParams={handleParams} />
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Apply to Adopt</h1>
        <p className="text-sm opacity-70">
          One application, every answer saved for next time — and you can watch
          its status live from the moment you submit.
        </p>
      </header>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {pets.length === 0 && !error ? (
        <div className="card bg-base-200">
          <div className="card-body items-center text-center">
            <h2 className="card-title">No pets available right now</h2>
            <p>Check back soon — new rescues arrive all the time.</p>
          </div>
        </div>
      ) : (
        <ApplicationForm
          pets={pets}
          defaultValues={defaults}
          preselectedPetId={preselectedPetId ?? undefined}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}

export default function AdoptPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        }
      >
        <AdoptContent />
      </Suspense>
    </ProtectedRoute>
  );
}
