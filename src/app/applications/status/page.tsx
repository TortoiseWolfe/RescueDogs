'use client';

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import { useApplicationRealtime } from '@/hooks/useApplicationRealtime';
import StatusTimeline from '@/components/organisms/StatusTimeline';
import StatusBadge from '@/components/atomic/StatusBadge';
import { isTerminalStatus } from '@/types/applications';
import SearchParamsReader from './SearchParamsReader';

/**
 * The live status tracker (Constitution Principle I: No One Gets Ghosted).
 * Realtime subscription keeps the timeline current the moment the shelter
 * acts; focus/visibility refetch covers tab sleep.
 */
function StatusTrackerContent() {
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const handleParams = useCallback((id: string | null) => {
    setApplicationId(id);
    setInitialized(true);
  }, []);

  const { application, loading, error, refetch } =
    useApplicationRealtime(applicationId);

  const handleWithdraw = useCallback(async () => {
    if (!applicationId) return;
    setWithdrawing(true);
    try {
      const service = new ApplicationService(supabase);
      await service.withdrawApplication(applicationId);
      setWithdrawError(null);
      await refetch();
    } catch {
      setWithdrawError(
        'Could not withdraw the application — please try again.'
      );
      await refetch();
    } finally {
      setWithdrawing(false);
      setConfirmingWithdraw(false);
    }
  }, [applicationId, refetch]);

  if (!initialized || loading) {
    return (
      <>
        <SearchParamsReader onParams={handleParams} />
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </>
    );
  }

  if (!applicationId || (!application && !error)) {
    return (
      <>
        <SearchParamsReader onParams={handleParams} />
        <div className="container mx-auto max-w-3xl p-6">
          <div role="alert" className="alert">
            <span>
              Application not found. Check the link, or see all of your
              applications.
            </span>
            <Link href="/applications" className="btn btn-sm">
              My applications
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SearchParamsReader onParams={handleParams} />
      <div className="container mx-auto max-w-3xl p-6">
        <div className="mb-4">
          <Link href="/applications" className="link link-hover text-sm">
            ← All my applications
          </Link>
        </div>

        {error && (
          <div role="alert" className="alert alert-warning mb-4">
            <span>
              We can&apos;t confirm the latest status right now — what you see
              may be out of date.
            </span>
            <button className="btn btn-sm" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        )}

        {application && (
          <>
            <header className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">
                  Application for {application.pets.name}
                </h1>
                {application.pets.breed && (
                  <p className="text-sm opacity-70">{application.pets.breed}</p>
                )}
              </div>
              <StatusBadge status={application.status} />
            </header>

            <StatusTimeline
              currentStatus={application.status}
              history={application.application_status_history}
            />

            {!isTerminalStatus(application.status) && (
              <div className="border-base-300 mt-8 border-t pt-4">
                {withdrawError && (
                  <div role="alert" className="alert alert-error mb-4">
                    <span>{withdrawError}</span>
                  </div>
                )}
                {confirmingWithdraw ? (
                  <div role="alert" className="alert">
                    <span>
                      Withdraw this application? The shelter will see it as
                      withdrawn and this can&apos;t be undone.
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-error btn-sm"
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                      >
                        {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmingWithdraw(false)}
                        disabled={withdrawing}
                      >
                        Keep my application
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm text-error"
                    onClick={() => setConfirmingWithdraw(true)}
                  >
                    Withdraw application
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function StatusTrackerPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        }
      >
        <StatusTrackerContent />
      </Suspense>
    </ProtectedRoute>
  );
}
