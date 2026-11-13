import {
  STATUS_LABELS,
  STATUS_ORDER,
  type ApplicationStatus,
} from '@/types/applications';

export interface HeroStatusStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

/** Most recently updated application. The list query is newest-created, not newest-updated. */
export function pickLatestApplication<T extends { status_changed_at: string }>(
  applications: readonly T[]
): T | null {
  if (applications.length === 0) return null;
  return applications.reduce((latest, application) =>
    Date.parse(application.status_changed_at) >
    Date.parse(latest.status_changed_at)
      ? application
      : latest
  );
}

/**
 * Compact pipeline for the homepage card. The full StatusTimeline also
 * renders the update history, which is too tall to sit under the hero
 * buttons, so this keeps the same labels and the same terminal-step swap.
 * Without history, a terminal application marks the earlier stages done.
 */
export function heroStatusSteps(status: ApplicationStatus): HeroStatusStep[] {
  if (status === 'not_selected' || status === 'withdrawn') {
    const prior = STATUS_ORDER.slice(0, -1).map((key) => ({
      label: STATUS_LABELS[key],
      state: 'done' as const,
    }));
    return [...prior, { label: STATUS_LABELS[status], state: 'current' }];
  }

  const currentIdx = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER.map((key, idx) => ({
    label: STATUS_LABELS[key],
    state:
      idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming',
  }));
}
