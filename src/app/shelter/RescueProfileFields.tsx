'use client';

import React from 'react';
import { US_STATE_OPTIONS } from '@/lib/browse/location-filters';

/**
 * The editable rescue profile, shared by create (#218) and settings (#331) so
 * the two forms cannot drift apart.
 */
export interface RescueProfileDraft {
  name: string;
  city: string;
  state: string;
  zip: string;
  contactEmail: string;
  transports: boolean;
  transportStates: string[];
  transportNote: string;
}

export const EMPTY_RESCUE_PROFILE: RescueProfileDraft = {
  name: '',
  city: '',
  state: '',
  zip: '',
  contactEmail: '',
  transports: false,
  transportStates: [],
  transportNote: '',
};

const FIELD_CLASS = 'input input-bordered min-h-11 w-full';

export function RescueIdentityFields({
  value,
  onChange,
  disabled = false,
  showContactEmail = false,
}: {
  value: RescueProfileDraft;
  onChange: (next: RescueProfileDraft) => void;
  disabled?: boolean;
  showContactEmail?: boolean;
}) {
  function patch(fields: Partial<RescueProfileDraft>) {
    onChange({ ...value, ...fields });
  }

  return (
    <>
      <label className="flex w-full flex-col" htmlFor="rescue-name">
        <span className="label-text mb-1 font-semibold">
          Shelter or Rescue Name
        </span>
        <input
          id="rescue-name"
          required
          minLength={2}
          maxLength={120}
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          className={FIELD_CLASS}
          autoComplete="organization"
          disabled={disabled}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex w-full flex-col" htmlFor="rescue-city">
          <span className="label-text mb-1 font-semibold">City</span>
          <input
            id="rescue-city"
            maxLength={100}
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            className={FIELD_CLASS}
            autoComplete="address-level2"
            disabled={disabled}
          />
        </label>
        {/* A dropdown, not free text: adopters filter on the 2-letter code, so a
            rescue that typed "Texas" used to be invisible in browse (#331). */}
        <label className="flex w-full flex-col" htmlFor="rescue-state">
          <span className="label-text mb-1 font-semibold">State</span>
          <select
            id="rescue-state"
            className="select select-bordered min-h-11 w-full"
            value={value.state}
            onChange={(e) => patch({ state: e.target.value })}
            disabled={disabled}
          >
            <option value="">Select a state</option>
            {US_STATE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name} ({option.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-full flex-col" htmlFor="rescue-zip">
          <span className="label-text mb-1 font-semibold">ZIP</span>
          <input
            id="rescue-zip"
            maxLength={20}
            value={value.zip}
            onChange={(e) => patch({ zip: e.target.value })}
            className={FIELD_CLASS}
            autoComplete="postal-code"
            disabled={disabled}
          />
        </label>
      </div>

      {showContactEmail ? (
        <label className="flex w-full flex-col" htmlFor="rescue-contact-email">
          <span className="label-text mb-1 font-semibold">
            Contact email (shown to adopters)
          </span>
          <input
            id="rescue-contact-email"
            type="email"
            maxLength={255}
            value={value.contactEmail}
            onChange={(e) => patch({ contactEmail: e.target.value })}
            className={FIELD_CLASS}
            autoComplete="email"
            disabled={disabled}
          />
        </label>
      ) : null}
    </>
  );
}

/**
 * Out-of-state transport (#331). The rescue-wide switch reveals the state
 * checklist; every listed pet is offered unless staff untick it individually.
 */
export function RescueTransportFields({
  value,
  onChange,
  disabled = false,
}: {
  value: RescueProfileDraft;
  onChange: (next: RescueProfileDraft) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value.transportStates);

  function patch(fields: Partial<RescueProfileDraft>) {
    onChange({ ...value, ...fields });
  }

  function toggleState(code: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    patch({ transportStates: Array.from(next).sort() });
  }

  const allSelected = selected.size === US_STATE_OPTIONS.length;

  return (
    <fieldset className="border-base-300 rounded-lg border p-4">
      <legend className="px-2 font-semibold">Transport</legend>

      <label className="label flex min-h-11 cursor-pointer items-start justify-start gap-3 p-0">
        <input
          type="checkbox"
          className="checkbox checkbox-primary mt-1"
          checked={value.transports}
          onChange={(e) => patch({ transports: e.target.checked })}
          disabled={disabled}
        />
        <span className="label-text">
          We transport animals out of state
          <span className="text-base-content/60 block text-xs">
            Adopters in the states you pick will see your animals when they
            include transportable pets in their search.
          </span>
        </span>
      </label>

      {value.transports ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              States we transport to
              <span className="text-base-content/60 ml-2 font-normal">
                {selected.size} selected
              </span>
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm min-h-11"
              disabled={disabled}
              onClick={() =>
                patch({
                  transportStates: allSelected
                    ? []
                    : US_STATE_OPTIONS.map((option) => option.code),
                })
              }
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>

          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {US_STATE_OPTIONS.map((option) => (
              <li key={option.code}>
                <label className="label flex min-h-11 cursor-pointer items-center justify-start gap-2 p-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={selected.has(option.code)}
                    onChange={(e) => toggleState(option.code, e.target.checked)}
                    disabled={disabled}
                  />
                  <span className="label-text text-sm">{option.name}</span>
                </label>
              </li>
            ))}
          </ul>

          <label
            className="flex w-full flex-col"
            htmlFor="rescue-transport-note"
          >
            <span className="label-text mb-1 font-semibold">
              Transport details (optional)
            </span>
            <textarea
              id="rescue-transport-note"
              className="textarea textarea-bordered min-h-24 w-full"
              value={value.transportNote}
              onChange={(e) => patch({ transportNote: e.target.value })}
              maxLength={500}
              rows={3}
              placeholder="e.g. Transport fee $300, ground transport twice a month."
              disabled={disabled}
            />
            <span className="label-text-alt text-base-content/60 mt-1">
              Shown to adopters on every listing you transport.
            </span>
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}
