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

export interface CreateMyShelterInput {
  name: string;
  city?: string;
  state?: string;
  zip?: string;
  contactEmail?: string;
}

export class AlreadyAMemberError extends Error {
  constructor() {
    super('already_a_member');
    this.name = 'AlreadyAMemberError';
  }
}

/** Reasons add_shelter_staff_by_email can refuse (#220). */
export const ADD_STAFF_ERROR_CODES = [
  'invalid_email',
  'not_a_manager',
  'user_not_found',
  'user_not_confirmed',
  'user_on_another_rescue',
] as const;

export type AddStaffErrorCode =
  | (typeof ADD_STAFF_ERROR_CODES)[number]
  | 'unknown';

export class AddStaffError extends Error {
  readonly code: AddStaffErrorCode;

  constructor(code: AddStaffErrorCode) {
    super(code);
    this.name = 'AddStaffError';
    this.code = code;
  }
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

  /**
   * First-time staff onboarding (#218). SECURITY DEFINER RPC — no client
   * INSERT on shelters / shelter_members. Rejects users who already belong
   * to a rescue (including demo staff).
   */
  async createMyShelter(input: CreateMyShelterInput): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_my_shelter', {
      p_name: input.name,
      p_city: input.city ?? null,
      p_state: input.state ?? null,
      p_zip: input.zip ?? null,
      p_contact_email: input.contactEmail ?? null,
    });

    if (error) {
      if (error.message?.includes('already_a_member')) {
        throw new AlreadyAMemberError();
      }
      throw error;
    }
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error('create_my_shelter returned no id');
    }
    return data;
  }

  /**
   * Add an existing Raised Paws user as staff of the caller's shelter (#220).
   * SECURITY DEFINER RPC — Postgres checks that the caller is a manager and
   * resolves the email against auth.users, which the client never sees.
   * Adding someone who is already on the shelter succeeds silently.
   */
  async addStaffByEmail(email: string): Promise<void> {
    const { error } = await this.supabase.rpc('add_shelter_staff_by_email', {
      p_email: email,
    });
    if (!error) return;

    const message = error.message ?? '';
    const code = ADD_STAFF_ERROR_CODES.find((candidate) =>
      message.includes(candidate)
    );
    throw new AddStaffError(code ?? 'unknown');
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
   * Applicant auth email for staff contact (#66). SECURITY DEFINER RPC —
   * only succeeds when the caller is shelter staff for that application.
   * Returns null if the RPC fails or email is missing (do not leak errors
   * that distinguish not-found vs unauthorized in the UI).
   */
  async getApplicantEmail(applicationId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc(
      'get_application_applicant_email',
      { p_application_id: applicationId }
    );
    if (error || typeof data !== 'string' || data.trim() === '') {
      return null;
    }
    return data;
  }

  /**
   * Advance an application along the pipeline. Postgres validates staff
   * membership, the transition map, and one-approved-per-pet (#34); the
   * optional note is shown to the adopter on their tracker
   * (Constitution Principle I). Leaving approved syncs pet availability
   * (#35).
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

  /**
   * Mark the pet adopted for an approved application (#35). Staff-only
   * SECURITY DEFINER RPC. Fall-through uses advanceStatus → not_selected.
   */
  async finalizeAdoption(applicationId: string): Promise<void> {
    const { error } = await this.supabase.rpc('finalize_adoption', {
      p_application_id: applicationId,
    });
    if (error) throw error;
  }
}
