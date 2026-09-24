'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Per-pet transport opt-out (#331). Rendered only when the rescue has the
 * transport switch on, so rescues that never ship never see the question.
 */
export function PetTransportField({
  transports,
  transportStates,
  value,
  onChange,
  disabled = false,
}: {
  /** Rescue-wide transport switch from the active membership. */
  transports: boolean;
  transportStates: string[];
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  if (!transports) return null;

  const stateCount = transportStates.length;

  return (
    <label className="label flex min-h-11 cursor-pointer items-start justify-start gap-3 p-0">
      <input
        type="checkbox"
        className="checkbox checkbox-primary mt-1"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="label-text">
        Available for transport
        <span className="text-base-content/60 block text-xs">
          Untick if this pet cannot travel. Your rescue transports to{' '}
          {stateCount} {stateCount === 1 ? 'state' : 'states'} —{' '}
          <Link href="/shelter/settings" className="link link-primary">
            change that in Settings
          </Link>
          .
        </span>
      </span>
    </label>
  );
}
