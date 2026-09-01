/**
 * Pet photo upload to Supabase Storage bucket `pet-photos` (#110).
 * Path: `{shelterId}/{petIdOrTemp}/{timestamp}.{ext}`
 */

import { createClient } from '@/lib/supabase/client';
import { withAsyncTimeout } from '@/lib/with-timeout';

const BUCKET = 'pet-photos';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 45_000;

export type PetPhotoUploadResult =
  | { url: string; error?: undefined }
  | {
      url: '';
      error: string;
    };

export function validatePetPhotoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `File size (${sizeMB}MB) exceeds the 5MB limit.`;
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Extract path inside `pet-photos` from a public URL.
 */
export function extractPetPhotoPathFromUrl(url: string): string {
  const parts = url.split(`/${BUCKET}/`);
  return parts[1] || '';
}

/**
 * Upload a pet photo. `folderId` is usually the pet id, or `new` before insert.
 */
export async function uploadPetPhoto(
  shelterId: string,
  folderId: string,
  file: File
): Promise<PetPhotoUploadResult> {
  const validationError = validatePetPhotoFile(file);
  if (validationError) {
    return { url: '', error: validationError };
  }

  const supabase = createClient();
  const ext = extensionForMime(file.type);
  const filePath = `${shelterId}/${folderId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await withAsyncTimeout(
    supabase.storage.from(BUCKET).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    }),
    UPLOAD_TIMEOUT_MS,
    'Photo upload'
  );

  if (uploadError) {
    return { url: '', error: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(uploadData.path);

  return { url: urlData.publicUrl };
}

/**
 * Upload a processed photo blob (e.g. after crop).
 */
export async function uploadPetPhotoBlob(
  shelterId: string,
  folderId: string,
  blob: Blob,
  contentType = 'image/webp'
): Promise<PetPhotoUploadResult> {
  if (blob.size > MAX_BYTES) {
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    return { url: '', error: `File size (${sizeMB}MB) exceeds the 5MB limit.` };
  }

  const supabase = createClient();
  const ext = extensionForMime(contentType);
  const filePath = `${shelterId}/${folderId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await withAsyncTimeout(
    supabase.storage.from(BUCKET).upload(filePath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    }),
    UPLOAD_TIMEOUT_MS,
    'Photo upload'
  );

  if (uploadError) {
    return { url: '', error: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(uploadData.path);

  return { url: urlData.publicUrl };
}
