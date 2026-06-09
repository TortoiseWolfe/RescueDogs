'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Application,
  ApplicationStatus,
  ApplicationWithPet,
  ApplicationWithPetAndHistory,
  ShelterRole,
} from '@/types/applications';

const PET_EMBED = 'pets(id, name, species, breed, photo_url, status)';

export interface ShelterMembershipInfo {
  shelterId: string;
  shelterName: string;
  role: ShelterRole;
}

/**
 * Shelter-staff-side data access. Reads are scoped by the
 * is_shelter_staff() RLS policies; the only mutation is the
 * advance_application_status RPC, which validates membership and the
 * transition map in Postgres.
 */
export class ShelterApplicationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * The user's shelter membership, or null if they aren't staff anywhere.
   * Powers ShelterGate. MVP: one membership per user (first row wins).
   */
  async getMyShelterMembership(
    userId: string
  ): Promise<ShelterMembershipInfo | null> {
    const { data, error } = await this.supabase
      .from('shelter_members')
      .select('shelter_id, role, shelters(name)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as {
      shelter_id: string;
      role: ShelterRole;
      shelters: { name: string } | null;
    };
    return {
      shelterId: row.shelter_id,
      shelterName: row.shelters?.name ?? '',
      role: row.role,
    };
  }

  /** The shelter's pipeline, optionally filtered by status. */
  async listShelterApplications(
    shelterId: string,
    status?: ApplicationStatus
  ): Promise<ApplicationWithPet[]> {
    let query = this.supabase
      .from('applications')
      .select(`*, ${PET_EMBED}`)
      .eq('shelter_id', shelterId)
      .order('status_changed_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as ApplicationWithPet[];
  }

  /** One application with snapshot, pet context, and full timeline. */
  async getApplication(
    id: string
  ): Promise<ApplicationWithPetAndHistory | null> {
    const { data, error } = await this.supabase
      .from('applications')
      .select(`*, ${PET_EMBED}, application_status_history(*)`)
      .eq('id', id)
      .order('created_at', {
        referencedTable: 'application_status_history',
        ascending: true,
      })
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as ApplicationWithPetAndHistory) ?? null;
  }

  /**
   * Advance an application along the pipeline. Postgres validates staff
   * membership and the transition; the optional note is shown to the
   * adopter on their tracker (Constitution Principle I).
   */
  async advanceStatus(
    applicationId: string,
    toStatus: ApplicationStatus,
    note?: string
  ): Promise<Application> {
    const { data, error } = await this.supabase.rpc(
      'advance_application_status',
      {
        p_application_id: applicationId,
        p_to_status: toStatus,
        p_note: note ?? null,
      }
    );

    if (error) throw error;
    return data as Application;
  }
}
