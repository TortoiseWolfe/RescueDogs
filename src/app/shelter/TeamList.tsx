'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  RemoveStaffError,
  ShelterApplicationService,
  type RemoveStaffErrorCode,
  type ShelterTeamMember,
} from '@/services/applications';
import { useShelterMembership } from './ShelterGate';

const FAILURE_COPY: Record<RemoveStaffErrorCode, string> = {
  not_a_manager: 'Only a rescue manager can remove teammates.',
  cannot_remove_self: 'You cannot remove yourself here.',
  not_a_member: 'That person is no longer on this team.',
  cannot_remove_manager: 'Managers cannot be removed here.',
  unknown: 'Could not remove that teammate. Please try again.',
};

function formatJoined(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TeamList({ refreshKey }: { refreshKey: number }) {
  const { role, shelterId } = useShelterMembership();
  const [members, setMembers] = useState<ShelterTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const service = new ShelterApplicationService(supabase);
      setMembers(await service.listShelterTeam(shelterId));
      setError(null);
    } catch {
      setError('Could not load the team. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    if (role !== 'manager') return;
    void loadTeam();
  }, [role, shelterId, refreshKey, loadTeam]);

  if (role !== 'manager') return null;

  async function onRemove(member: ShelterTeamMember) {
    const name = member.displayName?.trim() || member.email;
    const confirmed = window.confirm(
      `Remove ${name}? They will lose access to this rescue's pets and applications.`
    );
    if (!confirmed) return;

    setRemovingId(member.userId);
    try {
      const service = new ShelterApplicationService(supabase);
      await service.removeStaff(shelterId, member.userId);
      setError(null);
      await loadTeam();
    } catch (err) {
      const code =
        err instanceof RemoveStaffError ? err.code : ('unknown' as const);
      setError(FAILURE_COPY[code]);
      if (code === 'not_a_member') await loadTeam();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="card bg-base-100 border-base-300 mt-8 border">
      <div className="card-body gap-3">
        <h2 className="card-title text-lg">Your Team</h2>
        {loading ? (
          <p className="text-base-content/70 text-sm">Loading team…</p>
        ) : error && members.length === 0 ? (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-sm min-h-11"
              onClick={() => void loadTeam()}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {error ? (
              <p role="alert" className="text-error text-sm">
                {error}
              </p>
            ) : null}
            <ul className="divide-base-300 divide-y">
              {members.map((member) => {
                const name = member.displayName?.trim() || member.email;
                return (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{name}</p>
                      {member.displayName?.trim() && member.email ? (
                        <p className="text-base-content/70 text-sm">
                          {member.email}
                        </p>
                      ) : null}
                      <p className="text-base-content/60 mt-1 text-sm">
                        Joined {formatJoined(member.joinedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge ${
                          member.role === 'manager'
                            ? 'badge-primary'
                            : 'badge-ghost'
                        }`}
                      >
                        {member.role === 'manager' ? 'Manager' : 'Staff'}
                      </span>
                      {member.role === 'staff' ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-error btn-sm min-h-11 min-w-11"
                          aria-label={`Remove ${name} from this rescue`}
                          disabled={removingId === member.userId}
                          onClick={() => void onRemove(member)}
                        >
                          {removingId === member.userId
                            ? 'Removing…'
                            : 'Remove'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
