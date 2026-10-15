'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ShelterApplicationService } from '@/services/applications';
import {
  PET_TAG_LABELS,
  shownCountForTag,
} from '@/lib/applications/question-settings';
import { PET_TAGS, type PetTag } from '@/types/applications';

export function PetTagsField({
  shelterId,
  petName,
  value,
  onChange,
  disabled = false,
}: {
  shelterId: string;
  petName: string;
  value: PetTag[];
  onChange: (next: PetTag[]) => void;
  disabled?: boolean;
}) {
  const [counts, setCounts] = useState<Partial<Record<PetTag, number>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const service = new ShelterApplicationService(supabase);
        const [bank, ids] = await Promise.all([
          service.listApplicationQuestions(),
          service.listShownQuestionIds(shelterId),
        ]);
        if (cancelled) return;
        const shown = new Set(ids);
        const next: Partial<Record<PetTag, number>> = {};
        for (const tag of PET_TAGS) {
          next[tag] = shownCountForTag(bank, shown, tag);
        }
        setCounts(next);
      } catch {
        if (!cancelled) setCounts({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shelterId]);

  function toggle(tag: PetTag) {
    onChange(
      value.includes(tag)
        ? value.filter((item) => item !== tag)
        : [...value, tag]
    );
  }

  const selected = PET_TAGS.filter((tag) => value.includes(tag));
  const who = petName.trim() || 'this pet';

  return (
    <fieldset>
      <legend className="text-base font-semibold">Pet tags</legend>
      <p className="text-base-content/70 mb-3 text-sm">
        Adds question groups only for this pet. Leave blank if none apply.
      </p>
      <div className="flex flex-wrap gap-2">
        {PET_TAGS.map((tag) => {
          const on = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`btn btn-sm min-h-11 ${on ? 'btn-primary' : ''}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(tag)}
            >
              {PET_TAG_LABELS[tag]}
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Shown on applications for {who}</span>
          <span className="text-base-content/70 block">
            {selected
              .map((tag) => {
                const count = counts[tag];
                return count === undefined
                  ? PET_TAG_LABELS[tag]
                  : `${PET_TAG_LABELS[tag]} (${count} ${
                      count === 1 ? 'question' : 'questions'
                    })`;
              })
              .join(' · ')}
          </span>
        </p>
      ) : null}
    </fieldset>
  );
}
