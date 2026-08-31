'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PetPhoto } from '@/types/applications';

export const MAX_PET_PHOTOS = 4;

const PHOTO_COLUMNS = 'id, pet_id, url, sort_order, created_at';

/**
 * Gallery CRUD for shelter pet photos (#273).
 */
export class PetPhotoService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async listPhotos(petId: string): Promise<PetPhoto[]> {
    const { data, error } = await this.supabase
      .from('pet_photos')
      .select(PHOTO_COLUMNS)
      .eq('pet_id', petId)
      .order('sort_order', { ascending: true });

    if (error) {
      // Gallery table may not exist until #273 migration is applied on Cloud.
      return [];
    }
    return (data ?? []) as PetPhoto[];
  }

  async addPhoto(
    petId: string,
    url: string,
    sortOrder: number
  ): Promise<PetPhoto> {
    const { data, error } = await this.supabase
      .from('pet_photos')
      .insert({ pet_id: petId, url, sort_order: sortOrder })
      .select(PHOTO_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to add pet photo: ${error.message}`);
    }
    return data as PetPhoto;
  }

  async deletePhoto(photoId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pet_photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      throw new Error(`Failed to delete pet photo: ${error.message}`);
    }
  }

  /** Reorder by photo id list (index = sort_order) and sync pets.photo_url. */
  async reorderPhotos(petId: string, orderedPhotoIds: string[]): Promise<void> {
    if (orderedPhotoIds.length > MAX_PET_PHOTOS) {
      throw new Error(`Maximum ${MAX_PET_PHOTOS} photos per pet`);
    }

    for (let i = 0; i < orderedPhotoIds.length; i++) {
      const { error } = await this.supabase
        .from('pet_photos')
        .update({ sort_order: i })
        .eq('id', orderedPhotoIds[i])
        .eq('pet_id', petId);

      if (error) {
        throw new Error(`Failed to reorder pet photos: ${error.message}`);
      }
    }

    await this.syncPrimaryPhotoUrl(petId);
  }

  async syncPrimaryPhotoUrl(petId: string): Promise<void> {
    const photos = await this.listPhotos(petId);
    const primaryUrl = photos[0]?.url ?? null;

    const { error } = await this.supabase
      .from('pets')
      .update({ photo_url: primaryUrl })
      .eq('id', petId);

    if (error) {
      throw new Error(`Failed to sync primary photo: ${error.message}`);
    }
  }
}
