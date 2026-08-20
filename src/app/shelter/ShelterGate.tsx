'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  AlreadyAMemberError,
  ShelterApplicationService,
} from '@/services/applications';
import type { ShelterMembershipInfo } from '@/services/applications';

const ShelterContext = createContext<ShelterMembershipInfo | null>(null);

/**
 * Shelter membership for pages under /shelter. Always non-null beneath a
 * mounted ShelterGate (the gate renders children only after membership
 * resolves).
 */
export function useShelterMembership(): ShelterMembershipInfo {
  const membership = useContext(ShelterContext);
  if (!membership) {
    throw new Error('useShelterMembership must be used under ShelterGate');
  }
  return membership;
}

/**
 * ShelterGate
 *
 * Clone of AdminGate (src/app/admin/AdminGate.tsx) for shelter staff.
 * Layered inside ProtectedRoute. Resolves the user's shelter membership and
 * renders the shelter chrome + children only for confirmed staff. The
 * safety properties are load-bearing — mirrored from AdminGate's pinned
 * regression cases:
 *
 * - `wasStaff` ref: once a membership check succeeded on this mount, a
 *   transient token-refresh flip must not clear the shelter chrome (we keep
 *   lastMembership). Non-staff see an explicit no-access card (no silent
 *   redirect to `/`).
 * - `cancelled` flag: async membership resolution must not setState after
 *   the effect cleaned up (user switched, unmount).
 * - Dep array `[user, authLoading]`: a `user` change re-runs the
 *   check against the new user.
 */
export function ShelterGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [membership, setMembership] = useState<
    ShelterMembershipInfo | null | undefined
  >(undefined); // undefined = checking, null = confirmed non-staff
  const wasStaff = useRef(false);
  const lastMembership = useRef<ShelterMembershipInfo | null>(null);

  useEffect(() => {
    if (membership) {
      wasStaff.current = true;
      lastMembership.current = membership;
    }
  }, [membership]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute renders the sign-in card path
    let cancelled = false;
    (async () => {
      const service = new ShelterApplicationService(supabase);
      const result = await service.getMyShelterMembership(user.id);
      if (cancelled) return;
      setMembership(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || membership === undefined) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </div>
    );
  }

  const effectiveMembership = membership ?? lastMembership.current;
  if (!effectiveMembership) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <div className="card bg-base-100 border-base-300 border shadow-xl">
          <div className="card-body gap-4">
            <h1 className="card-title text-2xl">Create your rescue</h1>
            <p className="text-base-content/80">
              This login is not linked to a shelter yet. Create your rescue to
              list pets and see applications. Founding use is at no charge.
            </p>
            <CreateRescueForm
              onCreated={async () => {
                const service = new ShelterApplicationService(supabase);
                const next = await service.getMyShelterMembership(user!.id);
                setMembership(next);
              }}
            />
            <ul className="text-base-content/80 list-disc space-y-1 pl-5 text-sm">
              <li>
                Trying the demo? Use{' '}
                <Link
                  href="/get-started?choose=1&demo=1"
                  className="link link-primary"
                >
                  Try Demo
                </Link>{' '}
                and pick the shelter door — sign-in prefills the staff account.
              </li>
              <li>
                Adopting instead? Use the adopter door — membership for shelters
                is separate from tracking an application.
              </li>
              <li>
                Need help?{' '}
                <Link
                  href="/contact?role=shelter"
                  className="link link-primary"
                >
                  Contact us
                </Link>{' '}
                or email contact@raisedpaws.com.
              </li>
            </ul>
            <div className="card-actions mt-2 flex flex-wrap gap-3">
              <Link
                href="/get-started?choose=1&demo=1"
                className="btn btn-ghost min-h-11"
              >
                Try Demo
              </Link>
              <Link href="/" className="btn btn-ghost min-h-11">
                Back home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ShelterContext.Provider value={effectiveMembership}>
      <div className="container mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">
            {effectiveMembership.shelterName}
          </h1>
          <p className="text-sm opacity-70">
            Signed in as shelter {effectiveMembership.role}
          </p>
          <nav
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Shelter sections"
          >
            <Link href="/shelter" className="btn btn-sm btn-ghost min-h-11">
              Applications
            </Link>
            <Link
              href="/shelter/pets"
              className="btn btn-sm btn-ghost min-h-11"
            >
              Pets
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </ShelterContext.Provider>
  );
}

function CreateRescueForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const service = new ShelterApplicationService(supabase);
      await service.createMyShelter({
        name,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
      });
      await onCreated();
    } catch (err) {
      if (err instanceof AlreadyAMemberError) {
        setError(
          'This account is already on a rescue. Sign in again to open it.'
        );
      } else {
        setError('Could not create your rescue. Check the name and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass = 'input input-bordered min-h-11 w-full';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="form-control">
        <span className="label-text mb-1 font-semibold">
          Shelter or Rescue Name
        </span>
        <input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
          autoComplete="organization"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="form-control">
          <span className="label-text mb-1 font-semibold">City</span>
          <input
            maxLength={100}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={fieldClass}
            autoComplete="address-level2"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 font-semibold">State</span>
          <input
            maxLength={50}
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={fieldClass}
            autoComplete="address-level1"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1 font-semibold">ZIP</span>
          <input
            maxLength={20}
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className={fieldClass}
            autoComplete="postal-code"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="btn btn-primary min-h-11"
        disabled={submitting}
      >
        {submitting ? 'Creating…' : 'Create Shelter or Rescue'}
      </button>
    </form>
  );
}
