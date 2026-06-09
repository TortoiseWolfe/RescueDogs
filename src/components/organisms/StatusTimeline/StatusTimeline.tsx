import React from 'react';
import StatusBadge from '@/components/atomic/StatusBadge';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type ApplicationStatus,
  type StatusHistoryEntry,
} from '@/types/applications';

export interface StatusTimelineProps {
  /** The application's current pipeline status */
  currentStatus: ApplicationStatus;
  /** Adopter-visible status change history (any order; rendered oldest first) */
  history: StatusHistoryEntry[];
  /** Additional CSS classes */
  className?: string;
}

/** Terminal branches that replace the final 'Approved' step. */
const TERMINAL_BRANCH_STEP_CLASSES: Partial<Record<ApplicationStatus, string>> =
  {
    not_selected: 'step-error',
    withdrawn: 'step-neutral',
  };

interface TimelineStep {
  key: ApplicationStatus;
  label: string;
  className: string;
  isCurrent: boolean;
}

function pipelineIndex(status: ApplicationStatus): number {
  return (STATUS_ORDER as readonly ApplicationStatus[]).indexOf(status);
}

/**
 * Furthest pipeline stage recorded in history — used when a terminal
 * branch (not_selected / withdrawn) ended the application so the steps
 * before the terminal stage stay marked up to where the application got.
 */
function reachedPipelineIndex(history: StatusHistoryEntry[]): number {
  return history.reduce((max, entry) => {
    for (const status of [entry.from_status, entry.to_status]) {
      if (status) {
        const idx = pipelineIndex(status);
        if (idx > max) max = idx;
      }
    }
    return max;
  }, 0);
}

function buildSteps(
  currentStatus: ApplicationStatus,
  history: StatusHistoryEntry[]
): TimelineStep[] {
  const branchClass = TERMINAL_BRANCH_STEP_CLASSES[currentStatus];

  if (!branchClass) {
    // Normal pipeline: submitted → … → approved
    const currentIdx = pipelineIndex(currentStatus);
    return STATUS_ORDER.map((status, idx) => {
      const completed = idx <= currentIdx;
      const isFinal = idx === STATUS_ORDER.length - 1;
      const variant = completed
        ? isFinal
          ? ' step-success'
          : ' step-primary'
        : '';
      return {
        key: status,
        label: STATUS_LABELS[status],
        className: `step${variant}`,
        isCurrent: idx === currentIdx,
      };
    });
  }

  // Terminal branch replaces the final 'Approved' step.
  const reached = Math.min(
    reachedPipelineIndex(history),
    STATUS_ORDER.length - 2
  );
  const steps: TimelineStep[] = STATUS_ORDER.slice(0, -1).map(
    (status, idx) => ({
      key: status,
      label: STATUS_LABELS[status],
      className: idx <= reached ? 'step step-primary' : 'step',
      isCurrent: false,
    })
  );
  steps.push({
    key: currentStatus,
    label: STATUS_LABELS[currentStatus],
    className: `step ${branchClass}`,
    isCurrent: true,
  });
  return steps;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * StatusTimeline component — the "pizza tracker" for an adoption
 * application. Renders the five pipeline stages as DaisyUI steps with the
 * current progress highlighted (terminal branches replace the final
 * 'Approved' step), plus a chronological list of status updates with
 * adopter-visible shelter notes.
 *
 * Presentational only: props in, nothing out.
 *
 * @category organisms
 */
export default function StatusTimeline({
  currentStatus,
  history,
  className = '',
}: StatusTimelineProps) {
  const steps = buildSteps(currentStatus, history);
  const sortedHistory = [...history].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className={`w-full ${className}`.trim()} data-testid="status-timeline">
      <ul
        className="steps steps-vertical lg:steps-horizontal w-full"
        aria-label="Application progress"
      >
        {steps.map((step) => (
          <li
            key={step.key}
            className={step.className}
            data-testid={`step-${step.key}`}
            aria-current={step.isCurrent ? 'step' : undefined}
          >
            {step.label}
          </li>
        ))}
      </ul>

      {/* div, not a landmark: pages may render several timelines and
          duplicate landmark labels violate axe landmark-unique. */}
      <div className="mt-6" data-testid="status-history">
        <h3 className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
          Updates
        </h3>
        {sortedHistory.length === 0 ? (
          <p
            className="text-base-content/60 mt-2 text-sm"
            data-testid="history-empty"
          >
            No updates yet.
          </p>
        ) : (
          <ol className="mt-2 space-y-3">
            {sortedHistory.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1"
                data-testid="history-entry"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={entry.to_status} className="badge-sm" />
                  <time
                    dateTime={entry.created_at}
                    className="text-base-content/60 text-xs"
                  >
                    {formatDate(entry.created_at)}
                  </time>
                </div>
                {entry.note && (
                  <div className="chat chat-start">
                    <div
                      className="chat-bubble chat-bubble-info text-sm"
                      data-testid="history-note"
                    >
                      {entry.note}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
