'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  ApplicationService,
  ShelterApplicationService,
} from '@/services/applications';
import type { ApplicationStatus } from '@/types/applications';
import { heroStatusSteps, pickLatestApplication } from './hero-status';

interface HeroStatusSummary {
  petName: string;
  status: ApplicationStatus;
  applicationId: string;
  hasMore: boolean;
}

const DOT_CLASS = {
  done: 'bg-[#1e3a8a]',
  current: 'bg-[#f97316]',
  upcoming: 'border-2 border-[#1e3a8a] bg-transparent',
} as const;

/**
 * Real application card for a signed-in adopter. Signed-out visitors,
 * adopters with no applications, and shelter staff get nothing — staff
 * use the queue at /shelter. The full timeline stays on the status page.
 */
export default function HeroStatusCard() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [summary, setSummary] = useState<HeroStatusSummary | null>(null);

  useEffect(() => {
    if (authLoading || !userId) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const applications = new ApplicationService(supabase);
        const shelters = new ShelterApplicationService(supabase);
        const [mine, membership] = await Promise.all([
          applications.getMyApplications(userId),
          shelters.getMyShelterMembership(userId),
        ]);
        if (cancelled) return;
        if (membership) {
          setSummary(null);
          return;
        }
        const latest = pickLatestApplication(mine);
        if (!latest) {
          setSummary(null);
          return;
        }
        setSummary({
          petName: latest.pets.name,
          status: latest.status,
          applicationId: latest.id,
          hasMore: mine.length > 1,
        });
      } catch {
        if (!cancelled) setSummary(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  if (!summary) return null;

  const steps = heroStatusSteps(summary.status);

  return (
    <article
      className="mx-auto mt-6 w-full max-w-sm rounded-2xl bg-white p-4 text-left shadow-lg ring-1 ring-[#172554]/10"
      aria-label={`Application for ${summary.petName}`}
    >
      <p className="text-xs font-semibold tracking-wide text-[#1e3a8a] uppercase">
        Your application
      </p>
      <h2 className="font-display text-xl font-bold text-[#172554]">
        {summary.petName}
      </h2>
      <ul className="mt-3 space-y-1.5" aria-label="Application progress">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex items-center gap-2 text-sm font-semibold text-[#172554]"
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full ${DOT_CLASS[step.state]}`}
            />
            <span
              className={step.state === 'current' ? 'font-bold' : undefined}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col items-start">
        <Link
          href={`/applications/status?id=${summary.applicationId}`}
          className="link inline-flex min-h-11 items-center font-semibold text-[#1e3a8a]"
        >
          View status
        </Link>
        {summary.hasMore ? (
          <Link
            href="/applications"
            className="link inline-flex min-h-11 items-center font-semibold text-[#1e3a8a]"
          >
            All my applications
          </Link>
        ) : null}
      </div>
    </article>
  );
}
