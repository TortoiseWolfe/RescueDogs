import React from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/atomic/StatusBadge';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type ApplicationStatus,
  type ApplicationWithPet,
} from '@/types/applications';

/**
 * Display order for filter tabs: the five pipeline stages followed by
 * the terminal branches.
 */
const TAB_STATUS_ORDER: readonly ApplicationStatus[] = [
  ...STATUS_ORDER,
  'not_selected',
  'withdrawn',
];

export interface ApplicationsTableProps {
  /** Applications to render (already filtered by the parent/service) */
  applications: ApplicationWithPet[];
  /** Currently active status filter tab */
  statusFilter: ApplicationStatus | 'all';
  /** Called when a filter tab is clicked */
  onFilterChange: (filter: ApplicationStatus | 'all') => void;
  /** Additional CSS classes */
  className?: string;
}

/** Short date for the "Last update" column, e.g. "Jun 9, 2026". */
function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * ApplicationsTable component - shelter staff pipeline list.
 *
 * Renders status filter tabs (with per-status counts) above a DaisyUI
 * table of applications: pet, applicant snapshot name, status badge,
 * last update date, and a "Review" link to the application detail page.
 *
 * Presentational only: filtering is performed by the parent; this
 * component renders what it is given plus the tab state.
 *
 * @category organisms
 */
export default function ApplicationsTable({
  applications,
  statusFilter,
  onFilterChange,
  className = '',
}: ApplicationsTableProps) {
  const countsByStatus = applications.reduce<
    Partial<Record<ApplicationStatus, number>>
  >((counts, application) => {
    counts[application.status] = (counts[application.status] ?? 0) + 1;
    return counts;
  }, {});

  // Only statuses that actually exist in the data get a tab — plus the
  // active filter itself, so the selected tab never disappears when its
  // (parent-filtered) result set is empty.
  const tabStatuses = TAB_STATUS_ORDER.filter(
    (status) => (countsByStatus[status] ?? 0) > 0 || status === statusFilter
  );

  return (
    <div
      className={`applications-table${className ? ` ${className}` : ''}`}
      data-testid="applications-table"
    >
      <div
        role="tablist"
        aria-label="Filter applications by status"
        className="tabs tabs-bordered mb-4 overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'all'}
          className={`tab min-h-11 flex-shrink-0 ${
            statusFilter === 'all' ? 'tab-active' : ''
          }`}
          onClick={() => onFilterChange('all')}
          data-testid="tab-all"
        >
          All ({applications.length})
        </button>
        {tabStatuses.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={statusFilter === status}
            className={`tab min-h-11 flex-shrink-0 ${
              statusFilter === status ? 'tab-active' : ''
            }`}
            onClick={() => onFilterChange(status)}
            data-testid={`tab-${status}`}
          >
            {STATUS_LABELS[status]} ({countsByStatus[status] ?? 0})
          </button>
        ))}
      </div>

      {applications.length === 0 ? (
        <p
          className="text-base-content/60 py-8 text-center"
          data-testid="applications-empty"
        >
          No applications in this view yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Pet</th>
                <th>Applicant</th>
                <th>Status</th>
                <th>Last update</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr
                  key={application.id}
                  data-testid={`application-row-${application.id}`}
                >
                  <td>
                    <div className="font-medium">{application.pets.name}</div>
                    {application.pets.breed && (
                      <div className="text-base-content/60 text-xs">
                        {application.pets.breed}
                      </div>
                    )}
                  </td>
                  <td>{application.profile_snapshot.full_name}</td>
                  <td>
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="whitespace-nowrap">
                    {formatShortDate(application.status_changed_at)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/shelter/application?id=${application.id}`}
                      className="btn btn-ghost btn-sm min-h-11"
                      aria-label={`Review application for ${application.pets.name} from ${application.profile_snapshot.full_name}`}
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
