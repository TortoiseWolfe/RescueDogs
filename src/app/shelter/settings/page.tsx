'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  ShelterApplicationService,
  ShelterUpdateError,
  type ShelterUpdateErrorCode,
} from '@/services/applications';
import { useShelterMembership } from '../ShelterGate';
import {
  EMPTY_RESCUE_PROFILE,
  RescueIdentityFields,
  RescueTransportFields,
  type RescueProfileDraft,
} from '../RescueProfileFields';

const UPDATE_ERROR_MESSAGES: Record<ShelterUpdateErrorCode, string> = {
  not_a_manager: 'Only a manager of this rescue can change these settings.',
  invalid_shelter: 'We could not find this rescue. Reload and try again.',
  invalid_name: 'Enter a rescue name between 2 and 120 characters.',
  invalid_city: 'That city name is too long.',
  invalid_state: 'Pick your state from the list.',
  invalid_zip: 'That ZIP code is too long.',
  invalid_contact_email: 'That contact email is too long.',
  invalid_transport_states: 'Pick transport states from the list.',
  invalid_transport_note: 'Keep transport details under 500 characters.',
  transport_states_required: 'Pick at least one state you transport to.',
  unknown: 'Could not save your changes. Please try again.',
};

/**
 * Edit the rescue profile + transport settings (#331). Rescues used to be
 * write-once, so a partner who signed up before transport existed had no way to
 * say where they ship.
 */
export default function ShelterSettingsPage() {
  const membership = useShelterMembership();
  const { shelterId, role } = membership;
  const isManager = role === 'manager';

  const [profile, setProfile] =
    useState<RescueProfileDraft>(EMPTY_RESCUE_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadShelter = useCallback(async () => {
    setLoading(true);
    try {
      const service = new ShelterApplicationService(supabase);
      const shelter = await service.getShelter(shelterId);
      if (!shelter) {
        setError('We could not load this rescue. Please try again.');
        return;
      }
      setProfile({
        name: shelter.name ?? '',
        city: shelter.city ?? '',
        state: shelter.state ?? '',
        zip: shelter.zip ?? '',
        contactEmail: shelter.contact_email ?? '',
        transports: shelter.transports,
        transportStates: shelter.transport_states,
        transportNote: shelter.transport_note ?? '',
      });
      setError(null);
    } catch {
      setError('We could not load this rescue. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    void loadShelter();
  }, [loadShelter]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (profile.transports && profile.transportStates.length === 0) {
      setError(UPDATE_ERROR_MESSAGES.transport_states_required);
      return;
    }

    setSaving(true);
    try {
      const service = new ShelterApplicationService(supabase);
      const updated = await service.updateMyShelter({
        shelterId,
        name: profile.name,
        city: profile.city || undefined,
        state: profile.state || undefined,
        zip: profile.zip || undefined,
        contactEmail: profile.contactEmail || undefined,
        transports: profile.transports,
        transportStates: profile.transportStates,
        transportNote: profile.transportNote || undefined,
      });
      setProfile((current) => ({
        ...current,
        state: updated.state ?? '',
        transports: updated.transports,
        transportStates: updated.transport_states,
      }));
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ShelterUpdateError
          ? UPDATE_ERROR_MESSAGES[err.code]
          : UPDATE_ERROR_MESSAGES.unknown
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Rescue settings</h2>
        <Link href="/shelter" className="btn btn-ghost btn-sm min-h-11">
          Back to Applications
        </Link>
      </div>

      {!isManager ? (
        <div role="status" className="alert">
          <span>
            Only a manager can change rescue settings. Ask a manager at your
            rescue to update them.
          </span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <RescueIdentityFields
          value={profile}
          onChange={setProfile}
          disabled={saving || !isManager}
          showContactEmail
        />

        <RescueTransportFields
          value={profile}
          onChange={setProfile}
          disabled={saving || !isManager}
        />

        {error ? (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        ) : null}

        {saved ? (
          <div role="status" className="alert alert-success">
            <span>Rescue settings saved.</span>
          </div>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary min-h-11"
          disabled={saving || !isManager}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
