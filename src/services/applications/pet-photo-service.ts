'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PetPhoto } from '@/types/applications';
import { extractPetPhotoPathFromUrl } from '@/lib/pet-photos/upload';
import { createLogger } from '@/lib/logger';

const logger = createLogger('pet-photos:service');
const PET_PHOTO_BUCKET = 'pet-photos';

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

  /**
   * Delete the image files behind these public URLs from the `pet-photos`
   * bucket (#372). Best effort: the database row is the source of truth, so a
   * Storage failure is logged and never thrown. URLs that are empty or not in
   * the bucket are skipped.
   */
  async removeStoredPhotos(
    urls: ReadonlyArray<string | null | undefined>
  ): Promise<void> {
    const paths = [
      ...new Set(
        urls
          .filter((url): url is string => Boolean(url))
          .map((url) => extractPetPhotoPathFromUrl(url))
          .filter(Boolean)
      ),
    ];
    if (paths.length === 0) return;
    try {
      const { error } = await this.supabase.storage
        .from(PET_PHOTO_BUCKET)
        .remove(paths);
      if (error) {
        logger.warn('Could not remove pet photo files', {
          error: error.message,
          paths,
        });
      }
    } catch (err) {
      logger.warn('Could not remove pet photo files', { error: err, paths });
    }
  }

  async deletePhoto(photoId: string): Promise<void> {
    if (isLegacyPetPhotoId(photoId)) {
      const petId = photoId.slice('legacy-'.length);
      // Read the url first: it is gone from the row once we null it.
      const { data: current } = await this.supabase
        .from('pets')
        .select('photo_url')
        .eq('id', petId)
        .maybeSingle();
      const { error } = await this.supabase
        .from('pets')
        .update({ photo_url: null })
        .eq('id', petId);

      if (error) {
        throw new Error(`Failed to remove photo: ${error.message}`);
      }
      await this.removeStoredPhotos([
        (current as { photo_url?: string | null } | null)?.photo_url,
      ]);
      return;
    }

    const { data, error } = await this.supabase
      .from('pet_photos')
      .delete()
      .eq('id', photoId)
      .select('url');

    if (error) {
      if (isPetPhotosTableMissing(error)) {
        throw new Error(
          'Could not remove photo: pet_photos table is not available yet.'
        );
      }
      throw new Error(`Failed to delete pet photo: ${error.message}`);
    }
    await this.removeStoredPhotos(
      ((data ?? []) as { url: string }[]).map((row) => row.url)
    );
  }

  /**
   * Reorder by photo id list (index = sort_order); the RPC also syncs
   * pets.photo_url. Must list every photo of the pet exactly once (#338).
   */
  async reorderPhotos(petId: string, orderedPhotoIds: string[]): Promise<void> {
    if (orderedPhotoIds.length > MAX_PET_PHOTOS) {
      throw new Error(`Maximum ${MAX_PET_PHOTOS} photos per pet`);
    }

    const { error } = await this.supabase.rpc('reorder_pet_photos', {
      p_pet_id: petId,
      p_photo_ids: orderedPhotoIds,
    });

    if (error) {
      if (error.message?.includes('invalid_photo_order')) {
        throw new Error(
          'The photos changed since this page loaded. Refresh and try again.'
        );
      }
      throw new Error(`Failed to reorder pet photos: ${error.message}`);
    }
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
