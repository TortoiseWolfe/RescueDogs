'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdopterProfile,
  Application,
  ApplicationWithPet,
  ApplicationWithPetAndHistory,
  Pet,
  ProfileSnapshot,
} from '@/types/applications';

/** Embedded-pet columns selected with every application row. */
const PET_EMBED = 'pets(id, name, species, breed, photo_url, status)';

export interface ApplicationSubmitInput {
  petId: string;
  shelterId: string;
  profile: ProfileSnapshot;
  whyThisPet?: string;
}

/**
 * Adopter-side data access for the anti-ghosting MVP.
 * All reads are RLS-scoped (own rows); the only mutations are the
 * RLS-checked INSERT and the withdraw_application RPC — status moves
 * happen exclusively in Postgres (Constitution Principle III).
 */
export class ApplicationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Pets that can be applied for (status = 'available'). */
  async getAvailablePets(): Promise<Pet[]> {
    const { data, error } = await this.supabase
      .from('pets')
      .select('*')
      .eq('status', 'available')
      .order('name');

    if (error) throw error;
    return (data ?? []) as Pet[];
  }

  /** The user's saved universal-application answers, if any. */
  async getAdopterProfile(userId: string): Promise<AdopterProfile | null> {
    const { data, error } = await this.supabase
      .from('adopter_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return (data as AdopterProfile) ?? null;
  }

  /**
   * Submit an application: refresh the reusable profile, then insert the
   * application with the answers frozen as profile_snapshot.
   */
  async submitApplication(
    userId: string,
    input: ApplicationSubmitInput
  ): Promise<Application> {
    const { error: profileError } = await this.supabase
      .from('adopter_profiles')
      .upsert({ id: userId, ...input.profile }, { onConflict: 'id' });

    if (profileError) throw profileError;

    const { data, error } = await this.supabase
      .from('applications')
      .insert({
        adopter_id: userId,
        pet_id: input.petId,
        shelter_id: input.shelterId,
        profile_snapshot: input.profile,
        why_this_pet: input.whyThisPet ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as Application;
  }

  /** The user's applications, newest first, with embedded pet context. */
  async getMyApplications(userId: string): Promise<ApplicationWithPet[]> {
    const { data, error } = await this.supabase
      .from('applications')
      .select(`*, ${PET_EMBED}`)
      .eq('adopter_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as ApplicationWithPet[];
  }

  /**
   * One application with pet context and the full status timeline.
   * Returns null when not found OR not visible under RLS — the tracker
   * shows a not-found state either way.
   */
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

  /** Withdraw an active application (adopter-only, validated in Postgres). */
  async withdrawApplication(id: string): Promise<Application> {
    const { data, error } = await this.supabase.rpc('withdraw_application', {
      p_application_id: id,
    });

    if (error) throw error;
    return data as Application;
  }
}
