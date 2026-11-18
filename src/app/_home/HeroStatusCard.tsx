'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import type { ApplicationStatus } from '@/types/applications';
import { applicationForHeroCard, heroStatusSteps } from './hero-status';

interface HeroStatusSummary {
  petName: string;
  status: ApplicationStatus;
  applicationId: string;
}

const DOT_CLASS = {
  done: 'bg-[#1e3a8a]',
  current: 'bg-[#f97316]',
  upcoming: 'border-2 border-[#c9bfae] bg-white',
  approved: 'bg-[#16a34a]',
  not_selected: 'bg-[#dc2626]',
  withdrawn: 'border-2 border-[#64748b] bg-white',
} as const;

const HERE = new Set(['current', 'approved', 'not_selected', 'withdrawn']);

/**
 * Latest application for a signed-in person. Signed-out visitors and people
 * with no applications see nothing. A shelter login that has also applied
 * still sees this card. On phones it sits centered under the painting.
 * From lg up it pins to the bottom-right of the hero so it does not
 * stretch the band or pull the left copy down (#594).
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
        const mine = await applications.getMyApplications(userId);
        if (cancelled) return;
        const latest = applicationForHeroCard(mine);
        if (!latest?.pets?.name) {
          setSummary(null);
          return;
        }
        setSummary({
          petName: latest.pets.name,
          status: latest.status,
          applicationId: latest.id,
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
    <Link
      href={`/applications/status?id=${summary.applicationId}`}
      aria-label={`Application for ${summary.petName}`}
      className="relative z-10 mx-auto mt-6 mb-2 block w-[16.25rem] rounded-2xl bg-white p-3 text-left shadow-lg ring-1 ring-[#172554]/10 lg:absolute lg:right-4 lg:bottom-10 lg:mx-0 lg:mt-0 lg:mb-0"
    >
      <p className="text-[10px] font-semibold tracking-wide text-[#1e3a8a] uppercase">
        Your application
      </p>
      <p className="font-display text-base leading-tight font-bold text-[#172554]">
        {summary.petName}
      </p>
      <ul className="mt-2" aria-label="Application progress">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="relative flex items-start gap-2 pb-1 last:pb-0"
            aria-current={HERE.has(step.state) ? 'step' : undefined}
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute top-2.5 left-[4px] h-[calc(100%-2px)] w-0.5 ${
                  step.state === 'done' ? 'bg-[#1e3a8a]' : 'bg-[#e7e0d5]'
                }`}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[step.state]}`}
            />
            <span className="text-[13px] leading-4 font-semibold text-[#172554]">
              {step.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-semibold text-[#1e3a8a]">View status</p>
    </Link>
  );
}
