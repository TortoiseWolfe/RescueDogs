import React from 'react';
import StatusBadge from '@/components/atomic/StatusBadge';
import StatusDropdown from '@/components/molecular/StatusDropdown';
import { HOUSING_TYPE_OPTIONS } from '@/schemas/application.schema';
import {
  STATUS_LABELS,
  isRenting,
  type ApplicationStatus,
  type ApplicationWithPetAndHistory,
  type PetSpecies,
  type ProfileSnapshot,
  type StatusHistoryEntry,
} from '@/types/applications';

export interface ApplicationDetailProps {
  /** Application with embedded pet and full status history. */
  application: ApplicationWithPetAndHistory;
  /** Called when staff advances the application to a new status. */
  onAdvance: (
    toStatus: ApplicationStatus,
    note?: string
  ) => void | Promise<void>;
  /** Disables status controls while a transition is in flight. */
  advancing?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const EM_DASH = '—';

const SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: 'Dog',
  cat: 'Cat',
};

function textOrDash(value: string | null | undefined): string {
  return typeof value === 'string' && value.trim() !== '' ? value : EM_DASH;
}

function yesNoOrDash(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return EM_DASH;
}

function countOrDash(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : EM_DASH;
}

function humanizeHousingType(
  value: ProfileSnapshot['housing_type'] | null | undefined
): string {
  if (!value) return EM_DASH;
  return (
    HOUSING_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

function formatAddress(snapshot: Partial<ProfileSnapshot>): string {
  const parts = [
    snapshot.address_line,
    snapshot.city,
    snapshot.state,
    snapshot.zip,
  ].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== ''
  );
  return parts.length > 0 ? parts.join(', ') : EM_DASH;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? EM_DASH
    : date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

function historyLabel(entry: StatusHistoryEntry): string {
  const to = STATUS_LABELS[entry.to_status] ?? entry.to_status;
  if (!entry.from_status) return to;
  const from = STATUS_LABELS[entry.from_status] ?? entry.from_status;
  return `${from} → ${to}`;
}

/** One labeled value inside a snapshot definition list. */
function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm opacity-70">{label}</dt>
      <dd className="font-medium whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

/** One form-mirroring section of the frozen snapshot. */
function SnapshotSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 text-base font-semibold">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

/**
 * ApplicationDetail component — staff view of a single adoption
 * application: pet context, the frozen profile snapshot exactly as
 * submitted (never the adopter's live profile — Constitution Principle
 * III), status controls, and the adopter-visible status history.
 *
 * Presentational only: props in, callbacks out.
 *
 * @category organisms
 */
export default function ApplicationDetail({
  application,
  onAdvance,
  advancing = false,
  className = '',
}: ApplicationDetailProps) {
  const uid = React.useId();
  const petHeadingId = `${uid}-pet`;
  const whyHeadingId = `${uid}-why`;
  const snapshotHeadingId = `${uid}-snapshot`;
  const updateHeadingId = `${uid}-update`;
  const historyHeadingId = `${uid}-history`;

  const pet = application.pets;
  // Defensive: a malformed row must render dashes, never crash.
  const snapshot = (application.profile_snapshot ??
    {}) as Partial<ProfileSnapshot>;
  const renting =
    snapshot.housing_type != null && isRenting(snapshot.housing_type);

  const history = [...(application.application_status_history ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const petSubtitle = [
    pet?.breed,
    pet?.species ? (SPECIES_LABELS[pet.species] ?? pet.species) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      data-testid="application-detail"
      aria-labelledby={petHeadingId}
      className={`flex flex-col gap-6 ${className}`.trim()}
    >
      {/* Pet context + current status */}
      <header className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4 sm:flex-row sm:items-center">
          {pet?.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- pet photos are remote shelter uploads; static export has no image optimizer
            <img
              src={pet.photo_url}
              alt={`Photo of ${pet.name}`}
              loading="lazy"
              className="h-24 w-24 rounded-xl object-cover"
            />
          )}
          <div className="min-w-0">
            <h2 id={petHeadingId} className="card-title">
              {pet?.name ?? EM_DASH}
            </h2>
            {petSubtitle && <p className="text-sm opacity-70">{petSubtitle}</p>}
          </div>
          <StatusBadge
            status={application.status}
            className="badge-lg sm:ml-auto"
          />
        </div>
      </header>

      {/* Why this pet */}
      {application.why_this_pet && (
        <section
          aria-labelledby={whyHeadingId}
          className="card bg-base-100 shadow-sm"
        >
          <div className="card-body gap-2">
            <h2 id={whyHeadingId} className="card-title text-lg">
              Why this pet
            </h2>
            <blockquote className="border-primary border-l-4 pl-4 italic opacity-90">
              {application.why_this_pet}
            </blockquote>
          </div>
        </section>
      )}

      {/* Frozen application snapshot — never the live adopter profile */}
      <section
        aria-labelledby={snapshotHeadingId}
        className="card bg-base-100 shadow-sm"
      >
        <div className="card-body gap-6">
          <div>
            <h2 id={snapshotHeadingId} className="card-title">
              Application snapshot
            </h2>
            <p className="text-sm opacity-70">
              Answers exactly as submitted with this application.
            </p>
          </div>

          <SnapshotSection id={`${uid}-about`} title="About You">
            <Field label="Full name" value={textOrDash(snapshot.full_name)} />
            <Field label="Phone" value={textOrDash(snapshot.phone)} />
            <Field label="Address" value={formatAddress(snapshot)} wide />
          </SnapshotSection>

          <SnapshotSection id={`${uid}-home`} title="Your Home">
            <Field
              label="Housing"
              value={humanizeHousingType(snapshot.housing_type)}
            />
            {renting && (
              <>
                <Field
                  label="Landlord approval"
                  value={yesNoOrDash(snapshot.landlord_approval)}
                />
                <Field
                  label="Landlord contact"
                  value={textOrDash(snapshot.landlord_contact)}
                />
              </>
            )}
            <Field label="Has yard" value={yesNoOrDash(snapshot.has_yard)} />
            {snapshot.has_yard === true && (
              <Field
                label="Yard fenced"
                value={yesNoOrDash(snapshot.yard_fenced)}
              />
            )}
          </SnapshotSection>

          <SnapshotSection id={`${uid}-household`} title="Household & Pets">
            <Field
              label="Adults in household"
              value={countOrDash(snapshot.household_adults)}
            />
            <Field
              label="Children in household"
              value={countOrDash(snapshot.household_children)}
            />
            <Field
              label="Other pets"
              value={textOrDash(snapshot.other_pets)}
              wide
            />
          </SnapshotSection>

          <SnapshotSection id={`${uid}-refs`} title="References & Experience">
            <Field label="Veterinarian" value={textOrDash(snapshot.vet_name)} />
            <Field
              label="Veterinarian phone"
              value={textOrDash(snapshot.vet_phone)}
            />
            <Field
              label="Experience"
              value={textOrDash(snapshot.experience)}
              wide
            />
          </SnapshotSection>
        </div>
      </section>

      {/* Status controls */}
      <section
        aria-labelledby={updateHeadingId}
        className="card bg-base-100 shadow-sm"
      >
        <div className="card-body gap-3">
          <h2 id={updateHeadingId} className="card-title text-lg">
            Update status
          </h2>
          <StatusDropdown
            currentStatus={application.status}
            onAdvance={onAdvance}
            disabled={advancing}
          />
        </div>
      </section>

      {/* Status history, oldest first */}
      <section
        aria-labelledby={historyHeadingId}
        className="card bg-base-100 shadow-sm"
      >
        <div className="card-body gap-3">
          <h2 id={historyHeadingId} className="card-title text-lg">
            Status history
          </h2>
          {history.length === 0 ? (
            <p className="text-sm opacity-70">No status changes yet.</p>
          ) : (
            <ol data-testid="status-history" className="flex flex-col gap-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="bg-base-200 flex flex-col gap-1 rounded-lg p-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <time
                    dateTime={entry.created_at}
                    className="text-sm whitespace-nowrap opacity-70"
                  >
                    {formatDate(entry.created_at)}
                  </time>
                  <div className="min-w-0">
                    <p className="font-medium">{historyLabel(entry)}</p>
                    {entry.note && (
                      <p className="text-sm opacity-80">{entry.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </article>
  );
}
