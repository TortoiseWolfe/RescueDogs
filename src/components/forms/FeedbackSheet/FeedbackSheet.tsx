'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { sendFeedback } from '@/lib/feedback/submit';
import { deviceFacts, factLine } from '@/lib/feedback/device-facts';

export interface FeedbackSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Callback when the sheet is dismissed */
  onClose: () => void;
}

const MAX_BODY = 2000;

/**
 * FeedbackSheet component
 *
 * One field, one button, and a sentence saying exactly what else is being sent.
 *
 * IT ASKS FOR ONE THING. No category picker, no severity, no email field. Somebody who has
 * just hit a bug is not in the mood to triage it, and a required category is how a report
 * becomes an abandoned form. The route they were on does the job a category would
 * (`device-facts.ts` carries it), without asking.
 *
 * NO SEND BUTTON OVER AN EMPTY BOX, rather than a disabled one. A control that is visibly
 * there and does nothing when tapped reads as a bug — which is a poor first impression on
 * the screen somebody reached to report one.
 *
 * SHOWN, NOT HARVESTED. `factLine` is rendered before anything is sent. A report that
 * quietly collects is a different product from one that says what it collects, and any
 * field added to `factsFrom` must reach this sentence or that promise stops being true.
 *
 * THE PICKER IS THE PRIVACY DESIGN. It opens the file library, never the camera and never a
 * view capture: somebody reporting a bug has already taken the screenshot, and a silent
 * capture would send whatever is on screen — which in this product may be another person's
 * application — without them seeing what left their machine. A browser has no crop step, so
 * the copy says to crop first rather than pretending there is one.
 *
 * @category forms
 */
export default function FeedbackSheet({ isOpen, onClose }: FeedbackSheetProps) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setBody('');
      setFile(null);
      setProblem(null);
    }
  }, [isOpen]);

  const facts = factLine(deviceFacts(pathname ?? undefined));

  const submit = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    setProblem(null);
    const result = await sendFeedback({
      body,
      screenshot: file,
      route: pathname ?? undefined,
    });
    setBusy(false);
    if (result.ok) onClose();
    else setProblem(result.message);
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
      data-testid="feedback-sheet"
    >
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold">Something not right?</h3>
        <p className="text-base-content py-2">
          Tell us what happened in your own words. It goes straight to the
          people who build this.
        </p>

        <label className="label" htmlFor="feedback-body">
          <span className="label-text">What happened</span>
        </label>
        <textarea
          id="feedback-body"
          data-testid="feedback-body"
          className="textarea textarea-bordered min-h-11 w-full"
          rows={5}
          maxLength={MAX_BODY}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="The application form lost everything when I hit back…"
        />

        <label className="label mt-2" htmlFor="feedback-shot">
          <span className="label-text">Add a picture (optional)</span>
        </label>
        <input
          id="feedback-shot"
          data-testid="feedback-attach"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="file-input file-input-bordered min-h-11 w-full"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-base-content mt-1 text-sm">
          Crop anything you do not want us to see before you choose it — a
          browser gives us no way to crop it here.
        </p>

        <p
          className="text-base-content mt-3 text-sm"
          data-testid="feedback-facts"
        >
          Sent with this: {facts}. No name, no email, nothing about anybody
          else.
        </p>

        {problem && (
          <p
            className="text-error mt-2"
            role="alert"
            data-testid="feedback-problem"
          >
            {problem}
          </p>
        )}

        <div className="modal-action">
          <button
            type="button"
            className="btn min-h-11"
            onClick={onClose}
            data-testid="feedback-cancel"
          >
            Not now
          </button>
          {/* Drawn only once there is something to send — never a disabled control. */}
          {body.trim() ? (
            <button
              type="button"
              className="btn btn-primary min-h-11"
              onClick={submit}
              data-testid="feedback-send"
            >
              {busy ? 'Sending…' : 'Send it'}
            </button>
          ) : (
            <span className="self-center text-sm" data-testid="feedback-empty">
              Write a sentence and Send appears.
            </span>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close">
          close
        </button>
      </form>
    </dialog>
  );
}
