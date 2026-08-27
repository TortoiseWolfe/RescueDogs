'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  AddStaffError,
  ShelterApplicationService,
} from '@/services/applications';
import type { AddStaffErrorCode } from '@/services/applications';
import { useShelterMembership } from './ShelterGate';

const FAILURE_COPY: Record<AddStaffErrorCode, string> = {
  invalid_email: 'Enter a valid email address.',
  invalid_shelter:
    'Could not tell which rescue to add them to. Refresh and try again.',
  not_a_manager: 'Only a rescue manager can add teammates.',
  user_not_found:
    'No Raised Paws account uses that email. Ask them to create an account first, then add them again.',
  user_not_confirmed:
    'That account has not confirmed its email yet. Ask them to click the link in their confirmation email, then try again.',
  unknown: 'Could not add that teammate. Please try again.',
};

/**
 * Manager-only "add a teammate" form (#220). Renders nothing for role=staff —
 * Postgres enforces the same rule, so hiding it is convenience, not the
 * security boundary. The invitee must already have a Raised Paws account;
 * there is no server on GitHub Pages to send an invite email.
 */
export default function AddStaffForm() {
  const { role, shelterId } = useShelterMembership();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (role !== 'manager') return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAdded(null);
    setSubmitting(true);
    try {
      const service = new ShelterApplicationService(supabase);
      await service.addStaffByEmail(email, shelterId);
      setAdded(email.trim());
      setEmail('');
    } catch (err) {
      setError(
        FAILURE_COPY[
          err instanceof AddStaffError ? err.code : ('unknown' as const)
        ]
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card bg-base-100 border-base-300 mt-8 border">
      <div className="card-body gap-3">
        <h2 className="card-title text-lg">Add a Teammate</h2>
        <p className="text-base-content/80 text-sm">
          They need a Raised Paws account first. Once added, they can see this
          rescue&apos;s pets and applications.
        </p>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="form-control flex-1">
            <span className="label-text mb-1 font-semibold">
              Their Account Email
            </span>
            <input
              required
              type="email"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered min-h-11 w-full"
              autoComplete="off"
              placeholder="volunteer@example.com"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary min-h-11"
            disabled={submitting}
          >
            {submitting ? 'Adding…' : 'Add Teammate'}
          </button>
        </form>
        {error ? (
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
        ) : null}
        {added ? (
          <p role="status" className="text-success text-sm">
            {added} can now sign in and open this rescue.
          </p>
        ) : null}
      </div>
    </section>
  );
}
