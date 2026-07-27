'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PortalType } from '@/lib/portal/portal-preference';
import {
  DEMO_BISCUIT_APPLICATION_ID,
  DEMO_TOUR_RESTART_EVENT,
  enterDemoMode,
  getTourStep,
  isDemoMode,
  isTourDismissed,
  oppositePortal,
  resolveTourRoleFromPath,
  setTourDismissed,
  setTourStep,
  switchDemoRoleHref,
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
  /** Test hook — replaces the real sign-out redirect switch. */
  onSwitchRole?: () => void | Promise<void>;
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
    title: 'Start as the adopter',
    body: 'This demo uses two logins. First, look at My Applications (Biscuit, Pepper, Tank). Next you’ll switch to the shelter to change a status — then come back here and you’ll see that shelter update appear on the adopter pages in real time.',
    cta: {
      href: `/applications/status?id=${DEMO_BISCUIT_APPLICATION_ID}`,
      label: "Open Biscuit's tracker",
    },
    match: (path) => path === '/applications',
  },
  {
    id: 'tracker',
    title: 'Status tracker',
    body: 'This timeline is what the adopter sees — current status and any notes from the shelter. Remember where Biscuit stands now so you can compare after the shelter makes a change.',
    match: (path) => path.startsWith('/applications/status'),
  },
  {
    id: 'live',
    title: 'Then switch to the shelter',
    body: 'Use Switch to shelter demo below. As staff, advance Biscuit’s status and add a note. Switch back to the adopter demo and reopen this tracker — the shelter’s update shows up here in real time.',
    match: (path) => path.startsWith('/applications/status'),
  },
];

const SHELTER_STEPS: TourStep[] = [
  {
    id: 'pipeline',
    title: 'Shelter side of the demo',
    body: 'You’re signed in as shelter staff. Advance an application here; the adopter sees that status change on their tracker in real time. Start with Biscuit in the pipeline.',
    cta: {
      href: `/shelter/application?id=${DEMO_BISCUIT_APPLICATION_ID}`,
      label: 'Review Biscuit',
    },
    match: (path) => path === '/shelter' || path === '/shelter/',
  },
  {
    id: 'review',
    title: 'Review the snapshot',
    body: "You're seeing the frozen application answers — not a live profile edit. Scroll the snapshot, then advance status when ready.",
    match: (path) => path.startsWith('/shelter/application'),
  },
  {
    id: 'advance',
    title: 'Change status, then switch back',
    body: 'Advance Biscuit’s status and add an adopter-visible note. Then use Switch to adopter demo, open Biscuit’s tracker again, and confirm the new status and note appear in real time.',
    match: (path) => path.startsWith('/shelter/application'),
  },
];

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
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
 * Always shows an obvious Switch role control on demo pages.
 *
 * @category organisms
 */
export default function DemoTour({
  className = '',
  forceDemoMode = false,
  forceRole,
  forcePathname,
  onSwitchRole,
}: DemoTourProps) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const pathnameFromRouter = usePathname() ?? '/';
  const pathname = normalizePath(forcePathname ?? pathnameFromRouter);
  const { signOut } = useAuth();

  const [active, setActive] = useState(false);
  const [role, setRole] = useState<PortalType | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(true);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(() => {
    const demo = forceDemoMode || isDemoMode();
    const nextRole = forceRole ?? resolveTourRoleFromPath(pathname);
    setActive(demo && nextRole != null);
    setRole(nextRole);
    if (nextRole) {
      setDismissed(isTourDismissed(nextRole));
      let step = getTourStep(nextRole);
      const steps = stepsFor(nextRole);
      const matchingIndexes = steps
        .map((s, i) => (s.match(pathname) ? i : -1))
        .filter((i) => i >= 0);
      if (matchingIndexes.length > 0 && !matchingIndexes.includes(step)) {
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

  const handleSwitchRole = async () => {
    if (!role || switching) return;
    setSwitching(true);
    try {
      if (onSwitchRole) {
        await onSwitchRole();
        return;
      }
      const next = oppositePortal(role);
      const href = switchDemoRoleHref(role);
      enterDemoMode(next);
      await signOut({ redirectTo: href });
    } finally {
      setSwitching(false);
    }
  };

  if (!active || !role) {
    return null;
  }

  const steps = stepsFor(role);
  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[clampedIndex];
  const showSteps = !dismissed && step.match(pathname);
  const opposite = oppositePortal(role);
  const switchLabel =
    opposite === 'shelter'
      ? 'Switch to shelter demo'
      : 'Switch to adopter demo';

  const handleDismiss = () => {
    setTourDismissed(role, true);
    setDismissed(true);
  };

  const handleNext = () => {
    if (clampedIndex >= steps.length - 1) {
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

  const roleLabel = role === 'shelter' ? 'Shelter' : 'Adopter';
  const isLast = clampedIndex >= steps.length - 1;

  return (
    <aside
      className={`border-secondary/30 bg-base-100 text-base-content mx-auto w-full max-w-5xl border-b px-4 py-3 sm:px-6 ${className}`.trim()}
      data-testid="demo-tour"
      data-tour-role={role}
      data-tour-step={showSteps ? step.id : 'switch-only'}
      aria-label="Demo controls"
    >
      {showSteps && (
        <div
          className="card bg-secondary/10 border-secondary/20 mb-3 border shadow-none"
          aria-labelledby={titleId}
        >
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
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base-content/70 text-sm">
          {role === 'adopter'
            ? 'Next: switch to the shelter demo, change Biscuit’s status, then switch back — you’ll see that update on the adopter pages in real time.'
            : 'After you change a status, switch back to the adopter demo and open the same application — the new status appears on the adopter tracker in real time.'}
        </p>
        <button
          type="button"
          className="btn btn-outline btn-secondary min-h-11 shrink-0"
          data-testid="demo-tour-switch-role"
          disabled={switching}
          onClick={() => void handleSwitchRole()}
        >
          {switching ? 'Switching…' : switchLabel}
        </button>
      </div>
    </aside>
  );
}
