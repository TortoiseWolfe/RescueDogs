import React from 'react';
import { STATUS_LABELS, type ApplicationStatus } from '@/types/applications';

/**
 * DaisyUI badge variant class per application status.
 * Exported so other components (tables, timelines, dropdowns) can reuse
 * the same status → color mapping.
 */
export const STATUS_BADGE_VARIANTS: Record<ApplicationStatus, string> = {
  submitted: 'badge-info',
  under_review: 'badge-primary',
  reference_check: 'badge-secondary',
  home_visit: 'badge-accent',
  approved: 'badge-success',
  not_selected: 'badge-error',
  withdrawn: 'badge-neutral',
};

export interface StatusBadgeProps {
  /** Application status to display */
  status: ApplicationStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatusBadge component - DaisyUI badge showing an application's
 * pipeline status with a human-readable label and per-status color.
 *
 * @category atomic
 */
export default function StatusBadge({
  status,
  className = '',
}: StatusBadgeProps) {
  const badgeClasses =
    `badge ${STATUS_BADGE_VARIANTS[status]} ${className}`.trim();

  return (
    <span className={badgeClasses} data-testid="status-badge">
      {STATUS_LABELS[status]}
    </span>
  );
}
