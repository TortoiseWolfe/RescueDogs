'use client';

import React, { useEffect, useState } from 'react';
import type {
  ApplicationQuestion,
  ShelterFlagRule,
} from '@/types/applications';
import {
  defaultFlagLabel,
  emptyFlagDraft,
  flagChoices,
  flagKind,
  isFlagRuleValid,
  toggleFlagAnswer,
} from '@/lib/applications/flag-settings';

export function RedFlagEditor({
  question,
  initial,
  isManager,
  saving,
  error,
  onSave,
  onClear,
  onClose,
}: {
  question: ApplicationQuestion;
  initial: ShelterFlagRule | null;
  isManager: boolean;
  saving: boolean;
  error: string | null;
  onSave: (rule: ShelterFlagRule) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const kind = flagKind(question);
  const [draft, setDraft] = useState<ShelterFlagRule>(
    initial ?? emptyFlagDraft(question)
  );

  useEffect(() => {
    if (initial) setDraft(initial);
  }, [initial]);

  const choices = flagChoices(question);
  const canSave = isManager && isFlagRuleValid(question, draft) && !saving;

  function setThreshold(next: number | null) {
    setDraft((current) => ({
      ...current,
      threshold: next,
      label: defaultFlagLabel(question, next),
    }));
  }

  return (
    <dialog className="modal modal-open" open aria-labelledby="red-flag-title">
      <div className="modal-box max-w-lg">
        <div className="flex items-start justify-between gap-2">
          <h2 id="red-flag-title" className="text-xl font-semibold">
            Red flag
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-11 min-w-11"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="mt-2 font-semibold">{question.wording}</p>

        {kind === 'choices' ? (
          <fieldset className="mt-4">
            <legend className="text-base-content/70 mb-2">
              Raise a red flag when the answer is:
            </legend>
            <div className="flex flex-col gap-2">
              {choices.map((choice) => {
                const checked = draft.answers.includes(choice.value);
                return (
                  <label
                    key={choice.value}
                    className="flex min-h-11 cursor-pointer items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={checked}
                      disabled={!isManager}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          answers: toggleFlagAnswer(
                            current.answers,
                            choice.value
                          ),
                        }))
                      }
                    />
                    <span>{choice.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {kind === 'number' || kind === 'count' || kind === 'age' ? (
          <div className="mt-4">
            <p className="text-base-content/70 mb-2">
              Raise a red flag when the answer is:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="select select-bordered min-h-11"
                disabled={!isManager}
                value={draft.comparator}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    comparator: event.target
                      .value as ShelterFlagRule['comparator'],
                  }))
                }
              >
                {kind === 'age' ? (
                  <option value="age_lt">Younger than</option>
                ) : kind === 'count' ? (
                  <>
                    <option value="lt">Fewer than</option>
                    <option value="gt">More than</option>
                  </>
                ) : (
                  <>
                    <option value="gt">More than</option>
                    <option value="lt">Less than</option>
                  </>
                )}
              </select>
              <input
                type="number"
                className="input input-bordered min-h-11 w-24"
                disabled={!isManager}
                value={draft.threshold ?? ''}
                min={0}
                onChange={(event) => {
                  const value = event.target.value;
                  setThreshold(value === '' ? null : Number(value));
                }}
              />
              <span>
                {kind === 'age'
                  ? 'years'
                  : kind === 'count'
                    ? 'entries'
                    : question.id === 'lif.hours_alone'
                      ? 'hours'
                      : ''}
              </span>
            </div>
          </div>
        ) : null}

        <label className="form-control mt-4">
          <span className="label-text">Label your staff will see</span>
          <input
            className="input input-bordered min-h-11"
            maxLength={80}
            disabled={!isManager}
            value={draft.label}
            onChange={(event) =>
              setDraft((current) => ({ ...current, label: event.target.value }))
            }
          />
        </label>

        <p className="mt-4 text-sm">On the applications dashboard:</p>
        <span className="badge badge-error text-error-content mt-2 min-h-11 px-4">
          {draft.label.trim() || 'Red flag'}
        </span>

        <p className="text-base-content/70 mt-4 text-sm">
          A flag never rejects an application or changes its status. Only your
          staff see it; the adopter never does.
        </p>

        {error ? (
          <div role="alert" className="alert alert-error mt-4">
            <span>{error}</span>
          </div>
        ) : null}

        <div className="modal-action flex-wrap">
          {initial ? (
            <button
              type="button"
              className="btn btn-ghost text-error min-h-11"
              disabled={!isManager || saving}
              onClick={onClear}
            >
              Turn off flag
            </button>
          ) : null}
          <button
            type="button"
            className="btn min-h-11"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            disabled={!canSave}
            onClick={() => onSave(draft)}
          >
            {saving ? 'Saving…' : 'Save flag'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </form>
    </dialog>
  );
}
