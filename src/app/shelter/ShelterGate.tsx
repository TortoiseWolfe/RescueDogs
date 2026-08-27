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
  pickActiveMembership,
  setLastShelterPreference,
} from '@/lib/portal/shelter-preference';
import {
  AlreadyAMemberError,
  ShelterApplicationService,
} from '@/services/applications';
import type { ShelterMembershipInfo } from '@/services/applications';

const ShelterContext = createContext<ShelterMembershipInfo | null>(null);

/**
 * Active shelter membership for pages under /shelter. Always non-null beneath
 * a mounted ShelterGate (the gate renders children only after membership
 * resolves). When the user belongs to 2+ rescues, ShelterGate shows a
 * switcher; callers still read a single active row (#261).
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
 * Layered inside ProtectedRoute. Resolves the user's shelter membership(s)
 * and renders the shelter chrome + children only for confirmed staff. The
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
  const [memberships, setMemberships] = useState<
    ShelterMembershipInfo[] | null | undefined
  >(undefined); // undefined = checking, null = confirmed non-staff
  const [activeShelterId, setActiveShelterId] = useState<string | null>(null);
  const wasStaff = useRef(false);
  const lastMembership = useRef<ShelterMembershipInfo | null>(null);
  const lastMemberships = useRef<ShelterMembershipInfo[]>([]);

  const resolvedList = memberships ?? lastMemberships.current;
  const activeMembership =
    (activeShelterId
      ? resolvedList.find((m) => m.shelterId === activeShelterId)
      : null) ??
    pickActiveMembership(resolvedList, activeShelterId) ??
    lastMembership.current;

  useEffect(() => {
    if (activeMembership) {
      wasStaff.current = true;
      lastMembership.current = activeMembership;
    }
    if (resolvedList.length > 0) {
      lastMemberships.current = resolvedList;
    }
  }, [activeMembership, resolvedList]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute renders the sign-in card path
    let cancelled = false;
    (async () => {
      const service = new ShelterApplicationService(supabase);
      const list = await service.listMyShelterMemberships(user.id);
      if (cancelled) return;
      if (list.length === 0) {
        setMemberships(null);
        setActiveShelterId(null);
        return;
      }
      const picked = pickActiveMembership(list);
      setMemberships(list);
      setActiveShelterId(picked?.shelterId ?? list[0].shelterId);
      if (picked) setLastShelterPreference(picked.shelterId);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  function handleShelterChange(shelterId: string) {
    setActiveShelterId(shelterId);
    setLastShelterPreference(shelterId);
  }

  if (authLoading || memberships === undefined) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </div>
    );
  }

  if (!activeMembership) {
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
                const list = await service.listMyShelterMemberships(user!.id);
                const picked = pickActiveMembership(list);
                setMemberships(list.length > 0 ? list : null);
                setActiveShelterId(picked?.shelterId ?? null);
                if (picked) setLastShelterPreference(picked.shelterId);
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
    <ShelterContext.Provider value={activeMembership}>
      <div className="container mx-auto p-6">
        <header className="mb-6">
          {resolvedList.length > 1 ? (
            <label className="form-control mb-2 max-w-md">
              <span className="label-text mb-1 font-semibold">
                Active rescue
              </span>
              <select
                className="select select-bordered min-h-11 w-full"
                aria-label="Active rescue"
                value={activeMembership.shelterId}
                onChange={(e) => handleShelterChange(e.target.value)}
              >
                {resolvedList.map((m) => (
                  <option key={m.shelterId} value={m.shelterId}>
                    {m.shelterName || m.shelterId}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <h1 className="text-2xl font-bold">
              {activeMembership.shelterName}
            </h1>
          )}
          {resolvedList.length > 1 ? (
            <h1 className="text-2xl font-bold">
              {activeMembership.shelterName}
            </h1>
          ) : null}
          <p className="text-sm opacity-70">
            Signed in as shelter {activeMembership.role}
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
        {/* Remount child pages when the active rescue changes so lists refetch. */}
        <div key={activeMembership.shelterId}>{children}</div>
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
