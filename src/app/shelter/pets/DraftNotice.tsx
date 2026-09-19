'use client';

import React from 'react';

/**
 * Tell the user their work is being kept, and let them throw it away (#310).
 *
 * The failure this exists alongside was SILENT: a rescue lost a half-filled listing
 * three times without the page ever indicating that anything was or was not being
 * saved. A fix that restores work just as silently would leave them guessing in the
 * other direction — wondering whether stale text will reappear next time. So the
 * draft says when it was saved, and offers a way out.
 */
export function DraftNotice({
  savedAt,
  onDiscard,
  restored = false,
}: {
  /** Epoch ms of the last write, or null when nothing is stored. */
  savedAt: number | null;
  onDiscard: () => void;
  /** True when this session began by restoring a draft, which is worth saying plainly. */
  restored?: boolean;
}) {
  if (savedAt === null) return null;

  const time = new Date(savedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className="text-base-content/70 flex flex-wrap items-center justify-between gap-2 text-sm"
      data-testid="draft-notice"
    >
      <span>
        {restored ? 'Restored your unsaved draft from ' : 'Draft saved '}
        <time dateTime={new Date(savedAt).toISOString()}>{time}</time>
      </span>
      <button
        type="button"
        onClick={onDiscard}
        className="btn btn-ghost btn-xs min-h-11 min-w-11"
      >
        Discard draft
      </button>
    </div>
  );
}
