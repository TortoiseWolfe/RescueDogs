import React from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/atomic/StatusBadge';
import type { ApplicationWithPet, PetSpecies } from '@/types/applications';

export interface ApplicationCardProps {
  /** Application joined with its pet, as returned by ApplicationService */
  application: ApplicationWithPet;
  /** Additional CSS classes */
  className?: string;
}

const SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: 'Dog',
  cat: 'Cat',
};

/**
 * Format an ISO timestamp as short relative time ("5m ago", "yesterday").
 * Mirrors the formatter in ConversationListItem; older than a week falls
 * back to a short date.
 */
function formatRelativeTime(timestamp: string): string {
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return '';

  const diffMs = Date.now() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * ApplicationCard component - Adopter-facing card for the "My Applications"
 * list. Shows the pet (name, breed/species, photo), the current pipeline
 * status as a StatusBadge, when the status last changed, and a link to the
 * live status tracker. Presentational only: props in, navigation out.
 *
 * @category molecular
 */
export default function ApplicationCard({
  application,
  className = '',
}: ApplicationCardProps) {
  const pet = application.pets;
  const petDetails = [pet.breed, SPECIES_LABELS[pet.species]]
    .filter(Boolean)
    .join(' · ');
  const updatedRelative = formatRelativeTime(application.status_changed_at);

  return (
    <article
      className={`card card-side bg-base-100 shadow-sm transition-shadow hover:shadow-md ${className}`.trim()}
      data-testid="application-card"
      aria-label={`Application for ${pet.name}`}
    >
      {pet.photo_url && (
        <figure className="w-24 shrink-0 sm:w-32">
          {/* eslint-disable-next-line @next/next/no-img-element -- pet photos are remote Supabase Storage URLs; static export runs with unoptimized images (see AvatarDisplay) */}
          <img
            src={pet.photo_url}
            alt={`Photo of ${pet.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </figure>
      )}

      <div className="card-body gap-2 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="card-title text-lg">{pet.name}</h3>
            {petDetails && (
              <p className="text-base-content/70 text-sm">{petDetails}</p>
            )}
          </div>
          <StatusBadge status={application.status} />
        </div>

        <div className="card-actions mt-2 items-center justify-between">
          {updatedRelative && (
            <span className="text-base-content/60 text-sm">
              Updated {updatedRelative}
            </span>
          )}
          <Link
            href={`/applications/status?id=${application.id}`}
            className="btn btn-primary btn-sm"
            aria-label={`View status of your application for ${pet.name}`}
          >
            View status
          </Link>
        </div>
      </div>
    </article>
  );
}
