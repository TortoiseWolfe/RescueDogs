'use client';

import React, { useState } from 'react';

import FeedbackSheet from '@/components/forms/FeedbackSheet';

export interface FeedbackLinkProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * FeedbackLink component
 *
 * The way to say the software is wrong, for somebody signed in.
 *
 * ONE COMPONENT, ONE SHEET. A second copy of that form would be a second place the "here is
 * what we are sending" sentence lives, and those two would drift — which is how a promise
 * about privacy quietly stops being true on one screen.
 *
 * IT IS NOT `/contact`. That is for a person writing to the RESCUE; it asks for a name and
 * an email because somebody writes back. This is a person telling US the software is broken,
 * and it becomes a tracked issue without anybody reading a mailbox. The caller decides which
 * of the two to draw — see `Footer`.
 *
 * FULL-OPACITY `text-base-content`, NOT a muted variant. This renders on `/`, and
 * `tests/e2e/color-contrast.spec.ts` runs axe's `color-contrast-enhanced` there: the gate in
 * this repo is WCAG **AAA (7:1)**, not AA, so a `/70` would fail it.
 *
 * `min-h-11` is the 44px touch target this repo asks of every control.
 *
 * @category atomic
 */
export default function FeedbackLink({ className = '' }: FeedbackLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-feedback"
        className={`btn btn-link min-h-11 px-0 text-base-content${className ? ` ${className}` : ''}`}
      >
        Something not right? Tell us
      </button>
      <FeedbackSheet isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
