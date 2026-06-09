'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ShelterApplicationService } from '@/services/applications';
import ApplicationDetail from '@/components/organisms/ApplicationDetail';
import type {
  ApplicationStatus,
  ApplicationWithPetAndHistory,
} from '@/types/applications';
import SearchParamsReader from './SearchParamsReader';

function ShelterApplicationContent() {
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [application, setApplication] =
    useState<ApplicationWithPetAndHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParams = useCallback((id: string | null) => {
    setApplicationId(id);
    setInitialized(true);
  }, []);

  const fetchApplication = useCallback(async () => {
    if (!applicationId) return;
    try {
      const service = new ShelterApplicationService(supabase);
      setApplication(await service.getApplication(applicationId));
      setError(null);
    } catch {
      setError('Could not load this application.');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (!initialized) return;
    if (!applicationId) {
      setLoading(false);
      return;
    }
    fetchApplication();
  }, [initialized, applicationId, fetchApplication]);

  const handleAdvance = useCallback(
    async (toStatus: ApplicationStatus, note?: string) => {
      if (!applicationId) return;
      setAdvancing(true);
      try {
        const service = new ShelterApplicationService(supabase);
        await service.advanceStatus(applicationId, toStatus, note);
        await fetchApplication();
        setError(null);
      } catch {
        setError(
          'Could not update the status — it may have changed in another tab. Refreshing.'
        );
        await fetchApplication();
      } finally {
        setAdvancing(false);
      }
    },
    [applicationId, fetchApplication]
  );

  return (
    <>
      <SearchParamsReader onParams={handleParams} />
      <div className="mb-4">
        <Link href="/shelter" className="link link-hover text-sm">
          ← Back to pipeline
        </Link>
      </div>
      {!initialized || loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : !application ? (
        <div role="alert" className="alert">
          <span>
            Application not found. It may have been removed, or the link is
            incorrect.
          </span>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="alert alert-warning mb-4">
              <span>{error}</span>
            </div>
          )}
          <ApplicationDetail
            application={application}
            onAdvance={handleAdvance}
            advancing={advancing}
          />
        </>
      )}
    </>
  );
}

export default function ShelterApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <ShelterApplicationContent />
    </Suspense>
  );
}
