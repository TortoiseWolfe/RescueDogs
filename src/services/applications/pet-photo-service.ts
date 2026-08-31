'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PetPhoto } from '@/types/applications';

export const MAX_PET_PHOTOS = 4;

const PHOTO_COLUMNS = 'id, pet_id, url, sort_order, created_at';

/** Synthetic id when gallery rows are stored on pets.photo_url only (pre-migration). */
export function legacyPetPhotoId(petId: string): string {
  return `legacy-${petId}`;
}

export function isLegacyPetPhotoId(photoId: string): boolean {
  return photoId.startsWith('legacy-');
}

/** True when Supabase has not applied the #273 pet_photos table yet. */
export function isPetPhotosTableMissing(error: { message?: string }): boolean {
  const msg = error.message ?? '';
  return (
    msg.includes('pet_photos') &&
    (msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      msg.includes('Could not find the table'))
  );
}

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
      if (isPetPhotosTableMissing(error)) {
        return this.addPhotoLegacy(petId, url, sortOrder);
      }
      throw new Error(`Failed to add pet photo: ${error.message}`);
    }
    return data as PetPhoto;
  }

  /** Primary photo only — until pet_photos migration is applied on Cloud. */
  private async addPhotoLegacy(
    petId: string,
    url: string,
    sortOrder: number
  ): Promise<PetPhoto> {
    if (sortOrder > 0) {
      throw new Error(
        'Multi-photo gallery needs a database update on Supabase. You can save one profile photo for now; ask an admin to apply the pet_photos migration.'
      );
    }

    const { error: updateError } = await this.supabase
      .from('pets')
      .update({ photo_url: url })
      .eq('id', petId);

    if (updateError) {
      throw new Error(`Failed to save photo: ${updateError.message}`);
    }

    return {
      id: legacyPetPhotoId(petId),
      pet_id: petId,
      url,
      sort_order: 0,
      created_at: new Date().toISOString(),
    };
  }

  async deletePhoto(photoId: string): Promise<void> {
    if (isLegacyPetPhotoId(photoId)) {
      const petId = photoId.slice('legacy-'.length);
      const { error } = await this.supabase
        .from('pets')
        .update({ photo_url: null })
        .eq('id', petId);

      if (error) {
        throw new Error(`Failed to remove photo: ${error.message}`);
      }
      return;
    }

    const { error } = await this.supabase
      .from('pet_photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      if (isPetPhotosTableMissing(error)) {
        throw new Error(
          'Could not remove photo: pet_photos table is not available yet.'
        );
      }
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
