'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdopterProfile,
  Application,
  ApplicationWithPet,
  ApplicationWithPetAndHistory,
  AvailablePet,
  BrowsePet,
  BrowsePetDetail,
  PetSpecies,
  ProfileSnapshot,
} from '@/types/applications';
import {
  normalizeBrowseLocationFilters,
  type BrowseLocationFilters,
} from '@/lib/browse/location-filters';

/** Embedded-pet columns selected with every application row. */
const PET_EMBED = 'pets(id, name, species, breed, photo_url, status)';

/** Soft co-brand (#169): shelter display name on apply/status. */
const SHELTER_NAME_EMBED = 'shelters(name)';

export interface ApplicationSubmitInput {
  petId: string;
  shelterId: string;
  profile: ProfileSnapshot;
  whyThisPet?: string;
}

export type { BrowseLocationFilters };

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

  /** Pets that can be applied for (status = 'available'), with shelter name. */
  async getAvailablePets(species?: PetSpecies): Promise<AvailablePet[]> {
    let query = this.supabase
      .from('pets')
      .select(`*, ${SHELTER_NAME_EMBED}`)
      .eq('status', 'available');

    if (species) {
      query = query.eq('species', species);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    // Generated Database types treat FK embeds as arrays; PostgREST returns an object.
    return (data ?? []) as unknown as AvailablePet[];
  }

  /**
   * Public browse list (#112 / #111): available pets for one species, with
   * shelter city/state/zip. Server filters: state, shelterId. Mile radius applied
   * client-side (#280) using shelter ZIP centroids.
   */
  async getBrowsePets(
    species: PetSpecies,
    filters: BrowseLocationFilters = {}
  ): Promise<BrowsePet[]> {
    const { state, shelterId } = normalizeBrowseLocationFilters(filters);
    const hasLocation = Boolean(state);
    const shelterEmbed = hasLocation
      ? 'shelters!inner(name, city, state, zip)'
      : 'shelters(name, city, state, zip)';

    let query = this.supabase
      .from('pets')
      .select(
        `id, shelter_id, name, species, breed, sex, age_years, size, photo_url, status, notes, created_at, ${shelterEmbed}`
      )
      .eq('status', 'available')
      .eq('species', species);

    if (shelterId) {
      query = query.eq('shelter_id', shelterId);
    }
    if (state) {
      query = query.eq('shelters.state', state);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    // Generated Database types treat FK embeds as arrays; PostgREST returns an object.
    return (data ?? []) as unknown as BrowsePet[];
  }

  /** Shelters with at least one available pet for browse filter UI (#280). */
  async listBrowseShelters(
    species: PetSpecies
  ): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.supabase
      .from('pets')
      .select('shelter_id, shelters!inner(id, name)')
      .eq('status', 'available')
      .eq('species', species)
      .order('name', { referencedTable: 'shelters' });

    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      shelter_id: string;
      shelters: { id: string; name: string };
    }>;

    const byId = new Map<string, string>();
    for (const row of rows) {
      const id = row.shelters?.id ?? row.shelter_id;
      const name = row.shelters?.name?.trim();
      if (id && name) byId.set(id, name);
    }

    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Public pet detail (#274): available pet with shelter + gallery when available.
   * Gallery query is separate so detail works before #273 migration is applied.
   */
  async getBrowsePet(petId: string): Promise<BrowsePetDetail | null> {
    const { data, error } = await this.supabase
      .from('pets')
      .select(
        `id, shelter_id, name, species, breed, sex, age_years, size, photo_url, status, notes, created_at,
        shelters(name, city, state, zip)`
      )
      .eq('id', petId)
      .eq('status', 'available')
      .maybeSingle();

    if (error) throw error;
    const pet = (data as unknown as BrowsePetDetail) ?? null;
    if (!pet) return null;

    const { data: photos, error: photosError } = await this.supabase
      .from('pet_photos')
      .select('url, sort_order')
      .eq('pet_id', petId)
      .order('sort_order', { ascending: true });

    if (!photosError && photos && photos.length > 0) {
      pet.pet_photos = photos;
    }

    return pet;
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
      .select(
        `*, ${PET_EMBED}, ${SHELTER_NAME_EMBED}, application_status_history(*)`
      )
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
