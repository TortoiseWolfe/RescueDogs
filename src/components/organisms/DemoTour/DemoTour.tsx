'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PortalType } from '@/lib/portal/portal-preference';
import {
  DEMO_BISCUIT_APPLICATION_ID,
  DEMO_TOUR_RESTART_EVENT,
  getTourStep,
  isDemoMode,
  isTourDismissed,
  resolveTourRoleFromPath,
  setTourDismissed,
  setTourStep,
} from '@/lib/demo/demo-session';

export interface DemoTourProps {
  /** Additional CSS classes */
  className?: string;
  /**
   * Force-show for Storybook / tests. Production uses sessionStorage demo mode.
   */
  forceDemoMode?: boolean;
  /** Override role detection from the URL (Storybook / tests). */
  forceRole?: PortalType;
  /** Override pathname matching (Storybook / tests). */
  forcePathname?: string;
}

type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Optional primary CTA */
  cta?: { href: string; label: string };
  /** Match when this step is the active card */
  match: (pathname: string) => boolean;
};

const ADOPTER_STEPS: TourStep[] = [
  {
    id: 'apps',
    title: 'Your applications',
    body: 'Biscuit, Pepper, and Tank sit at different stages. Open one to see where you stand — no chasing the shelter.',
    cta: {
      href: `/applications/status?id=${DEMO_BISCUIT_APPLICATION_ID}`,
      label: "Open Biscuit's tracker",
    },
    match: (path) => path === '/applications',
  },
  {
    id: 'tracker',
    title: 'Status tracker',
    body: 'This timeline and any shelter notes are what the adopter sees. Status should never be a mystery.',
    match: (path) => path.startsWith('/applications/status'),
  },
  {
    id: 'live',
    title: 'Live updates',
    body: 'When shelter staff advance a status or leave a note, it shows up here without you refreshing endlessly. Optional: open the shelter demo in another window and advance Biscuit to feel the “aha.”',
    match: (path) => path.startsWith('/applications/status'),
  },
];

const SHELTER_STEPS: TourStep[] = [
  {
    id: 'pipeline',
    title: 'Shelter pipeline',
    body: 'Submitted, in-progress, and closed applications live here. Pick an applicant to review without leaving the loop.',
    cta: {
      href: `/shelter/application?id=${DEMO_BISCUIT_APPLICATION_ID}`,
      label: 'Review Biscuit',
    },
    match: (path) => path === '/shelter' || path === '/shelter/',
  },
  {
    id: 'review',
    title: 'Review the snapshot',
    body: 'You’re seeing the frozen application answers — not a live profile edit. Scroll the snapshot, then advance status when ready.',
    match: (path) => path.startsWith('/shelter/application'),
  },
  {
    id: 'advance',
    title: 'Advance + note',
    body: 'Change status and add an adopter-visible note. That’s the anti-ghosting moment — the adopter’s tracker updates live.',
    match: (path) => path.startsWith('/shelter/application'),
  },
];

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  // Strip trailing slash except root
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function stepsFor(role: PortalType): TourStep[] {
  return role === 'shelter' ? SHELTER_STEPS : ADOPTER_STEPS;
}

/**
 * Compact DaisyUI callout for demo sessions (#68).
 * Path-aware, max 3 steps per role, dismissible / restartable.
 *
 * @category organisms
 */
export default function DemoTour({
  className = '',
  forceDemoMode = false,
  forceRole,
  forcePathname,
}: DemoTourProps) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const pathnameFromRouter = usePathname() ?? '/';
  const pathname = normalizePath(forcePathname ?? pathnameFromRouter);

  const [active, setActive] = useState(false);
  const [role, setRole] = useState<PortalType | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(true);

  const refresh = useCallback(() => {
    const demo = forceDemoMode || isDemoMode();
    const nextRole = forceRole ?? resolveTourRoleFromPath(pathname);
    setActive(demo && nextRole != null);
    setRole(nextRole);
    if (nextRole) {
      setDismissed(isTourDismissed(nextRole));
      let step = getTourStep(nextRole);
      const steps = stepsFor(nextRole);
      // Snap to a step that matches this page when possible
      const matchingIndexes = steps
        .map((s, i) => (s.match(pathname) ? i : -1))
        .filter((i) => i >= 0);
      if (matchingIndexes.length > 0 && !matchingIndexes.includes(step)) {
        // Prefer the furthest matching step already reached, else first match
        const preferred =
          matchingIndexes.find((i) => i >= step) ?? matchingIndexes[0];
        step = preferred;
        setTourStep(nextRole, step);
      }
      setStepIndex(step);
    }
  }, [forceDemoMode, forceRole, pathname]);

  useEffect(() => {
    refresh();
    const onRestart = () => refresh();
    window.addEventListener(DEMO_TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(DEMO_TOUR_RESTART_EVENT, onRestart);
  }, [refresh]);

  if (!active || !role || dismissed) {
    return null;
  }

  const steps = stepsFor(role);
  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[clampedIndex];
  if (!step.match(pathname)) {
    return null;
  }

  const isLast = clampedIndex >= steps.length - 1;
  const roleLabel = role === 'shelter' ? 'Shelter' : 'Adopter';

  const handleDismiss = () => {
    setTourDismissed(role, true);
    setDismissed(true);
  };

  const handleNext = () => {
    if (isLast) {
      handleDismiss();
      return;
    }
    const next = clampedIndex + 1;
    setTourStep(role, next);
    setStepIndex(next);
  };

  const handleBack = () => {
    if (clampedIndex <= 0) return;
    const prev = clampedIndex - 1;
    setTourStep(role, prev);
    setStepIndex(prev);
  };

  return (
    <aside
      className={`border-secondary/30 bg-base-100 text-base-content mx-auto w-full max-w-5xl border-b px-4 py-3 sm:px-6 ${className}`.trim()}
      data-testid="demo-tour"
      data-tour-role={role}
      data-tour-step={step.id}
      aria-labelledby={titleId}
    >
      <div className="card bg-secondary/10 border-secondary/20 border shadow-none">
        <div className="card-body gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-secondary text-xs font-semibold tracking-wide uppercase">
              Demo tour · {roleLabel} · Step {clampedIndex + 1} of{' '}
              {steps.length}
            </p>
            <h2 id={titleId} className="mt-1 text-base font-bold sm:text-lg">
              {step.title}
            </h2>
            <p className="text-base-content/80 mt-1 text-sm motion-safe:transition-opacity">
              {step.body}
            </p>
            {step.cta && (
              <Link
                href={step.cta.href}
                className="btn btn-secondary btn-sm mt-3 min-h-11"
              >
                {step.cta.label}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-col sm:items-stretch">
            {clampedIndex > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm min-h-11"
                onClick={handleBack}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm min-h-11"
              onClick={handleNext}
              data-testid="demo-tour-next"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm min-h-11"
              onClick={handleDismiss}
              data-testid="demo-tour-skip"
              aria-label="Skip demo tour"
            >
              Skip tour
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
