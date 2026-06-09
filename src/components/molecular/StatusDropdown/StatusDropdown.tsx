'use client';

import React, { useId, useState } from 'react';
import {
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  isTerminalStatus,
  type ApplicationStatus,
} from '@/types/applications';

export interface StatusDropdownProps {
  /** The application's current pipeline status */
  currentStatus: ApplicationStatus;
  /**
   * Called when staff advance the application. Receives the chosen target
   * status and an optional adopter-visible note.
   */
  onAdvance: (
    toStatus: ApplicationStatus,
    note?: string
  ) => void | Promise<void>;
  /** Disable all controls (e.g. while a previous update is in flight) */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatusDropdown component - staff control to advance an adoption
 * application through the status pipeline.
 *
 * Only the legal transitions from the current status (STATUS_TRANSITIONS)
 * are offered. Terminal targets (approved / not_selected) require an
 * inline confirmation step before onAdvance is called, because they are
 * final and immediately visible on the adopter's tracker.
 *
 * Presentational: props in, callbacks out — no data fetching.
 *
 * @category molecular
 */
export default function StatusDropdown({
  currentStatus,
  onAdvance,
  disabled = false,
  className = '',
}: StatusDropdownProps) {
  const baseId = useId();
  const selectId = `${baseId}-status`;
  const noteId = `${baseId}-note`;

  const [selected, setSelected] = useState<ApplicationStatus | ''>('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  const targets = STATUS_TRANSITIONS[currentStatus];

  // Terminal current status: nothing left for staff to do.
  if (targets.length === 0) {
    return (
      <p
        className={`text-base-content/60 text-sm italic ${className}`.trim()}
        data-testid="status-dropdown-no-actions"
      >
        No further actions
      </p>
    );
  }

  const advance = async (toStatus: ApplicationStatus) => {
    const trimmedNote = note.trim();
    try {
      await onAdvance(toStatus, trimmedNote === '' ? undefined : trimmedNote);
    } finally {
      setSelected('');
      setNote('');
      setConfirming(false);
    }
  };

  const handleUpdateClick = () => {
    if (selected === '') return;
    if (isTerminalStatus(selected)) {
      // Final statuses get an inline confirm step before firing.
      setConfirming(true);
      return;
    }
    void advance(selected);
  };

  return (
    <div
      className={`flex flex-col gap-3 ${className}`.trim()}
      data-testid="status-dropdown"
    >
      <div className="form-control">
        <label htmlFor={selectId} className="label">
          <span className="label-text font-semibold">New status</span>
        </label>
        <select
          id={selectId}
          className="select select-bordered w-full"
          value={selected}
          disabled={disabled}
          onChange={(e) => {
            setSelected(e.target.value as ApplicationStatus | '');
            setConfirming(false);
          }}
        >
          <option value="">Select new status…</option>
          {targets.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-control">
        <label htmlFor={noteId} className="label">
          <span className="label-text">
            Note to applicant (visible on their tracker)
          </span>
        </label>
        <textarea
          id={noteId}
          className="textarea textarea-bordered w-full"
          rows={2}
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {confirming && selected !== '' ? (
        <div role="alert" className="alert alert-warning">
          <span className="text-sm">
            This is final and immediately visible to the applicant.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm min-h-11"
              disabled={disabled}
              onClick={() => void advance(selected)}
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm min-h-11"
              disabled={disabled}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary min-h-11"
          disabled={disabled || selected === ''}
          onClick={handleUpdateClick}
        >
          Update status
        </button>
      )}
    </div>
  );
}
