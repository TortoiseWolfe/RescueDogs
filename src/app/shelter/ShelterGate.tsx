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
import { ShelterApplicationService } from '@/services/applications';
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
            <h1 className="card-title text-2xl">
              No shelter access on this account
            </h1>
            <p className="text-base-content/80">
              This login is not linked to a shelter membership. Shelter pipeline
              pages are for staff who have been added to a rescue.
            </p>
            <ul className="text-base-content/80 list-disc space-y-1 pl-5 text-sm">
              <li>
                Trying the demo? Use{' '}
                <Link
                  href="/get-started?choose=1&demo=1"
                  className="link link-primary"
                >
                  Try the Demo
                </Link>{' '}
                and pick the shelter door — sign-in prefills the staff account.
              </li>
              <li>
                Adopting instead? Use the adopter door — membership for shelters
                is separate from tracking an application.
              </li>
            </ul>
            <div className="card-actions mt-2 flex flex-wrap gap-3">
              <Link
                href="/get-started?choose=1&demo=1"
                className="btn btn-primary min-h-11"
              >
                Try the Demo
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
            Application pipeline — signed in as shelter{' '}
            {effectiveMembership.role}
          </p>
        </header>
        {children}
      </div>
    </ShelterContext.Provider>
  );
}
