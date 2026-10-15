'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { clearFormDraft } from '@/hooks/useFormDraft';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';
import SoftCoBrand from '@/components/molecular/SoftCoBrand';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import type { AvailablePet } from '@/types/applications';
import type { ApplicationQuestion } from '@/types/applications';
import {
  AdopterApplicationFlow,
  type AdopterApplicationSubmitPayload,
} from './AdopterApplicationFlow';
import SearchParamsReader from './SearchParamsReader';

function AdoptContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [preselectedPetId, setPreselectedPetId] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [pets, setPets] = useState<AvailablePet[]>([]);
  const [bank, setBank] = useState<ApplicationQuestion[]>([]);
  const [shownByShelter, setShownByShelter] = useState<Map<string, string[]>>(
    new Map()
  );
  const [savedAnswers, setSavedAnswers] = useState<Map<string, unknown>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParams = useCallback((petId: string | null) => {
    setPreselectedPetId(petId);
  }, []);

  const handlePetIdChange = useCallback((petId: string) => {
    setSelectedPetId(petId);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const service = new ApplicationService(supabase);
        const [availablePets, answerRows, questions] = await Promise.all([
          service.getAvailablePets(),
          service.listAdopterAnswers(user.id),
          service.listApplicationQuestions(),
        ]);
        if (cancelled) return;

        const shelterIds = [
          ...new Set(availablePets.map((pet) => pet.shelter_id)),
        ];
        const shownEntries = await Promise.all(
          shelterIds.map(
            async (shelterId) =>
              [
                shelterId,
                await service.listShownQuestionIds(shelterId),
              ] as const
          )
        );

        setPets(availablePets);
        setBank(questions);
        setShownByShelter(new Map(shownEntries));
        setSavedAnswers(
          new Map(answerRows.map((row) => [row.question_id, row.value]))
        );
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

  const shelterName =
    pets.find((p) => p.id === selectedPetId)?.shelters?.name?.trim() || null;

  useEffect(() => {
    if (!shelterName) return;
    const previous = document.title;
    document.title = `Apply with ${shelterName} | Raised Paws`;
    return () => {
      document.title = previous;
    };
  }, [shelterName]);

  const fallbackName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    return meta?.full_name?.trim() || user?.email || 'Applicant';
  }, [user]);

  const handleSubmit = useCallback(
    async (payload: AdopterApplicationSubmitPayload) => {
      if (!user) return;
      setSubmitting(true);
      try {
        const service = new ApplicationService(supabase);
        const application = await service.submitApplication(user.id, {
          petId: payload.petId,
          shelterId: payload.shelterId,
          profile: payload.profile,
          whyThisPet: payload.whyThisPet,
          answers: payload.answers,
          snapshotOmitQuestionIds: payload.snapshotOmitQuestionIds,
        });
        clearFormDraft(`adopt:application:${user.id}`);
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
    [user, router]
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
        {shelterName && (
          <SoftCoBrand
            shelterName={shelterName}
            context="apply"
            className="mt-3"
          />
        )}
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
        <AdopterApplicationFlow
          pets={pets}
          preselectedPetId={preselectedPetId ?? undefined}
          savedAnswers={savedAnswers}
          bank={bank}
          shownByShelter={shownByShelter}
          fallbackName={fallbackName}
          submitting={submitting}
          onPetIdChange={handlePetIdChange}
          onSubmit={handleSubmit}
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
