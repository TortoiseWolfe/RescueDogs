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
          <div className="card-body items-center gap-4 text-center">
            <h2 className="card-title text-2xl">
              Welcome — let&apos;s get you started
            </h2>
            <p className="text-base-content/80 max-w-md">
              You do not have any adoption applications yet. Browse pets, then
              complete the reusable universal application so shelters can review
              you without the silence.
            </p>
            <p className="text-base-content/70 max-w-md text-sm">
              Your legal name and contact details go in the application (private
              to the shelter). A friendly{' '}
              <Link href="/account" className="link link-primary">
                display name
              </Link>{' '}
              in Account Settings is optional and used for messaging — it is
              separate from your application full name.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <Link
                href="/#meet-pets-heading"
                className="btn btn-primary min-h-11"
              >
                Browse Pets
              </Link>
              <Link href="/adopt" className="btn btn-secondary min-h-11">
                Start an Application
              </Link>
            </div>
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
