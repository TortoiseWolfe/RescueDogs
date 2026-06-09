'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ShelterApplicationService } from '@/services/applications';
import ApplicationsTable from '@/components/organisms/ApplicationsTable';
import { useShelterMembership } from './ShelterGate';
import type {
  ApplicationStatus,
  ApplicationWithPet,
} from '@/types/applications';

/**
 * Shelter pipeline dashboard. Lists every application for the staff
 * member's shelter; the status filter is client-side tab state over the
 * full (RLS-scoped) list. Refetches on window focus so a dashboard left
 * open on the front desk stays honest.
 */
export default function ShelterPipelinePage() {
  const { shelterId } = useShelterMembership();
  const [applications, setApplications] = useState<ApplicationWithPet[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>(
    'all'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      const service = new ShelterApplicationService(supabase);
      setApplications(await service.listShelterApplications(shelterId));
      setError(null);
    } catch {
      setError('Could not load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    fetchApplications();
    const onFocus = () => fetchApplications();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchApplications]);

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
        <button className="btn btn-sm" onClick={fetchApplications}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <ApplicationsTable
      applications={applications}
      statusFilter={statusFilter}
      onFilterChange={setStatusFilter}
    />
  );
}
