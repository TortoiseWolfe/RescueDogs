'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Application,
  ApplicationStatus,
  ApplicationWithPet,
  ApplicationWithPetAndHistory,
  Shelter,
  ShelterRole,
} from '@/types/applications';
import { normalizeTransportStates } from '@/lib/browse/transport';

const PET_EMBED = 'pets(id, name, species, breed, photo_url, status)';

const SHELTER_COLUMNS =
  'id, name, city, state, zip, contact_email, transports, transport_states, transport_note, created_at';

export interface ShelterMembershipInfo {
  shelterId: string;
  shelterName: string;
  role: ShelterRole;
  /** Rescue-wide transport switch, so pet forms know whether to offer the opt-out (#331). */
  transports: boolean;
  /** States this rescue transports to (#331). */
  transportStates: string[];
}

export interface ShelterProfileInput {
  name: string;
  city?: string;
  state?: string;
  zip?: string;
  contactEmail?: string;
  /** Rescue-wide transport switch (#331). */
  transports?: boolean;
  /** States this rescue transports to; required when `transports` (#331). */
  transportStates?: string[];
  /** Optional public transport details (#331). */
  transportNote?: string;
}

export type CreateMyShelterInput = ShelterProfileInput;

export type UpdateMyShelterInput = ShelterProfileInput & { shelterId: string };

export class AlreadyAMemberError extends Error {
  constructor() {
    super('already_a_member');
    this.name = 'AlreadyAMemberError';
  }
}

/** Reasons update_my_shelter can refuse (#331). */
export const SHELTER_UPDATE_ERROR_CODES = [
  'not_a_manager',
  'invalid_shelter',
  'invalid_name',
  'invalid_city',
  'invalid_state',
  'invalid_zip',
  'invalid_contact_email',
  'invalid_transport_states',
  'invalid_transport_note',
  'transport_states_required',
] as const;

export type ShelterUpdateErrorCode =
  | (typeof SHELTER_UPDATE_ERROR_CODES)[number]
  | 'unknown';

export class ShelterUpdateError extends Error {
  readonly code: ShelterUpdateErrorCode;

  constructor(code: ShelterUpdateErrorCode) {
    super(code);
    this.name = 'ShelterUpdateError';
    this.code = code;
  }
}

/**
 * The longest-matching code wins: `invalid_transport_states` contains
 * `invalid_state` as a substring, so a naive `find` would mislabel it.
 */
function shelterUpdateErrorCode(message: string): ShelterUpdateErrorCode {
  const matches = SHELTER_UPDATE_ERROR_CODES.filter((candidate) =>
    message.includes(candidate)
  ).sort((a, b) => b.length - a.length);
  return matches[0] ?? 'unknown';
}

/** Reasons add_shelter_staff_by_email can refuse (#220 / #261). */
export const ADD_STAFF_ERROR_CODES = [
  'invalid_email',
  'invalid_shelter',
  'not_a_manager',
  'user_not_found',
  'user_not_confirmed',
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
   * Every shelter membership for this user (#261). Ordered by shelter name
   * so the switcher is stable. Empty array when they aren't staff anywhere.
   * Throws on query failure so callers can distinguish error from empty (#285).
   */
  async listMyShelterMemberships(
    userId: string
  ): Promise<ShelterMembershipInfo[]> {
    const { data, error } = await this.supabase
      .from('shelter_members')
      .select('shelter_id, role, shelters(name, transports, transport_states)')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
    if (!data) return [];
    const rows = data as unknown as Array<{
      shelter_id: string;
      role: ShelterRole;
      shelters: {
        name: string;
        transports?: boolean | null;
        transport_states?: string[] | null;
      } | null;
    }>;
    return rows
      .map((row) => ({
        shelterId: row.shelter_id,
        shelterName: row.shelters?.name ?? '',
        role: row.role,
        transports: row.shelters?.transports === true,
        transportStates: normalizeTransportStates(
          row.shelters?.transport_states
        ),
      }))
      .sort((a, b) =>
        a.shelterName.localeCompare(b.shelterName, undefined, {
          sensitivity: 'base',
        })
      );
  }

  /**
   * One membership for "am I staff anywhere?" callers (post-login path).
   * Prefer listMyShelterMemberships + pickActiveMembership under ShelterGate.
   * Soft-fails to null on query error so login still lands somewhere (#285).
   */
  async getMyShelterMembership(
    userId: string
  ): Promise<ShelterMembershipInfo | null> {
    try {
      const memberships = await this.listMyShelterMemberships(userId);
      return memberships[0] ?? null;
    } catch {
      return null;
    }
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
      p_transports: input.transports ?? false,
      p_transport_states: normalizeTransportStates(input.transportStates),
      p_transport_note: input.transportNote ?? null,
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

  /** The rescue's own profile row, for the settings form (#331). */
  async getShelter(shelterId: string): Promise<Shelter | null> {
    const { data, error } = await this.supabase
      .from('shelters')
      .select(SHELTER_COLUMNS)
      .eq('id', shelterId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as unknown as Shelter;
    return {
      ...row,
      transports: row.transports === true,
      transport_states: normalizeTransportStates(row.transport_states),
    };
  }

  /**
   * Manager-only edit of the rescue profile + transport settings (#331).
   * SECURITY DEFINER RPC — shelters has no client UPDATE policy, and rescues
   * created before transport existed have no other way to opt in.
   */
  async updateMyShelter(input: UpdateMyShelterInput): Promise<Shelter> {
    const transports = input.transports ?? false;
    const { data, error } = await this.supabase.rpc('update_my_shelter', {
      p_shelter_id: input.shelterId,
      p_name: input.name,
      p_city: input.city ?? null,
      p_state: input.state ?? null,
      p_zip: input.zip ?? null,
      p_contact_email: input.contactEmail ?? null,
      p_transports: transports,
      p_transport_states: transports
        ? normalizeTransportStates(input.transportStates)
        : [],
      p_transport_note: input.transportNote ?? null,
    });

    if (error) {
      throw new ShelterUpdateError(shelterUpdateErrorCode(error.message ?? ''));
    }
    if (!data) {
      throw new ShelterUpdateError('unknown');
    }

    const row = data as unknown as Shelter;
    return {
      ...row,
      transports: row.transports === true,
      transport_states: normalizeTransportStates(row.transport_states),
    };
  }

  /**
   * Add an existing Raised Paws user as staff of the active shelter (#220/#261).
   * SECURITY DEFINER RPC — Postgres checks that the caller is a manager of
   * p_shelter_id and resolves the email against auth.users. Invitees may
   * already belong to another rescue; same-shelter re-add is a no-op.
   */
  async addStaffByEmail(email: string, shelterId: string): Promise<void> {
    const { error } = await this.supabase.rpc('add_shelter_staff_by_email', {
      p_email: email,
      p_shelter_id: shelterId,
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
