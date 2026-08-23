'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Pet,
  PetSex,
  PetSize,
  PetSpecies,
  PetStatus,
} from '@/types/applications';

const PET_COLUMNS =
  'id, shelter_id, name, species, breed, sex, age_years, size, photo_url, status, notes, created_at';

export type PetWriteInput = {
  name: string;
  species: PetSpecies;
  breed?: string | null;
  sex?: PetSex | null;
  age_years?: number | null;
  size?: PetSize | null;
  status?: PetStatus;
  photo_url?: string | null;
  notes?: string | null;
};

/**
 * Shelter-staff pet CRUD (#110 / #167). RLS enforces is_shelter_staff(shelter_id).
 */
export class ShelterPetService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async listPets(shelterId: string): Promise<Pet[]> {
    const { data, error } = await this.supabase
      .from('pets')
      .select(PET_COLUMNS)
      .eq('shelter_id', shelterId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list pets: ${error.message}`);
    }
    return (data ?? []) as Pet[];
  }

  async getPet(petId: string): Promise<Pet | null> {
    const { data, error } = await this.supabase
      .from('pets')
      .select(PET_COLUMNS)
      .eq('id', petId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load pet: ${error.message}`);
    }
    return data as Pet | null;
  }

  async createPet(shelterId: string, input: PetWriteInput): Promise<Pet> {
    const { data, error } = await this.supabase
      .from('pets')
      .insert({
        shelter_id: shelterId,
        name: input.name.trim(),
        species: input.species,
        breed: input.breed?.trim() || null,
        sex: input.sex ?? null,
        age_years: input.age_years ?? null,
        size: input.size ?? null,
        status: input.status ?? 'available',
        photo_url: input.photo_url ?? null,
        notes: input.notes?.trim() || null,
      })
      .select(PET_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to create pet: ${error.message}`);
    }
    return data as Pet;
  }

  async updatePet(petId: string, input: Partial<PetWriteInput>): Promise<Pet> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.species !== undefined) patch.species = input.species;
    if (input.breed !== undefined) patch.breed = input.breed?.trim() || null;
    if (input.sex !== undefined) patch.sex = input.sex;
    if (input.age_years !== undefined) patch.age_years = input.age_years;
    if (input.size !== undefined) patch.size = input.size;
    if (input.status !== undefined) patch.status = input.status;
    if (input.photo_url !== undefined) patch.photo_url = input.photo_url;
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

    const { data, error } = await this.supabase
      .from('pets')
      .update(patch)
      .eq('id', petId)
      .select(PET_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to update pet: ${error.message}`);
    }
    return data as Pet;
  }

  async getPetApplicationCount(petId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId);

    if (error) {
      throw new Error(`Failed to count applications: ${error.message}`);
    }
    return count ?? 0;
  }

  async deletePet(petId: string): Promise<void> {
    const { error } = await this.supabase.from('pets').delete().eq('id', petId);

    if (error) {
      throw new Error(`Failed to delete pet: ${error.message}`);
    }
  }
}
