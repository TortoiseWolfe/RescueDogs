'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import ApplicationCard from '@/components/molecular/ApplicationCard';
import type { ApplicationWithPet } from '@/types/applications';

function MyApplicationsContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    try {
      const service = new ApplicationService(supabase);
      setApplications(await service.getMyApplications(user.id));
      setError(null);
    } catch {
      setError('Could not load your applications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchApplications();
    const onFocus = () => fetchApplications();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authLoading, user, fetchApplications]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <Link href="/adopt" className="btn btn-primary btn-sm">
          Apply to adopt
        </Link>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={fetchApplications}>
            Retry
          </button>
        </div>
      )}

      {applications.length === 0 && !error ? (
        <div className="card bg-base-200">
          <div className="card-body items-center text-center">
            <h2 className="card-title">No applications yet</h2>
            <p>
              When you apply to adopt, you can track every application here — no
              more wondering what happened.
            </p>
            <Link href="/adopt" className="btn btn-primary">
              Find your new best friend
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4" aria-label="Your adoption applications">
          {applications.map((app) => (
            <li key={app.id}>
              <ApplicationCard application={app} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyApplicationsPage() {
  return (
    <ProtectedRoute>
      <MyApplicationsContent />
    </ProtectedRoute>
  );
}
