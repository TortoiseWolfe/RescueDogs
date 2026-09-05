/**
 * Pet photo upload to Supabase Storage bucket `pet-photos` (#110).
 * Path: `{shelterId}/{petIdOrTemp}/{timestamp}.{ext}`
 */

import { createClient } from '@/lib/supabase/client';
import { withAsyncTimeout } from '@/lib/with-timeout';

const BUCKET = 'pet-photos';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Input cap for phone camera JPEGs (#284). Crop still stores ~1200×900 WebP. */
export const PET_PHOTO_MAX_INPUT_MB = 15;
export const PET_PHOTO_MAX_INPUT_BYTES = PET_PHOTO_MAX_INPUT_MB * 1024 * 1024;
/** Long-edge cap for direct uploads (#192). Crop path already stores ~1200×900. */
const MAX_STORED_EDGE = 1600;
const STORED_QUALITY = 0.82;
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
  if (file.size > PET_PHOTO_MAX_INPUT_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `File size (${sizeMB}MB) exceeds the ${PET_PHOTO_MAX_INPUT_MB}MB limit.`;
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
 * Downscale a photo in the browser so Storage never holds a multi-megabyte
 * phone original. Aspect ratio is preserved, unlike the avatar pipeline in
 * `src/lib/avatar/image-processing.ts` which forces a square. Returns the
 * untouched file when the canvas APIs are unavailable or the image already
 * fits within `maxEdge`.
 *
 * The live shelter UI crops via `uploadPetPhotoBlob` (~1200×900 WebP). This
 * helper covers direct `uploadPetPhoto` callers and keeps #192 forward-safe.
 */
export async function downscalePetPhoto(
  file: File,
  maxEdge: number = MAX_STORED_EDGE
): Promise<{ data: Blob; type: string }> {
  const original = { data: file, type: file.type };

  if (
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  ) {
    return original;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);

    if (longestEdge <= maxEdge) {
      bitmap.close();
      return original;
    }

    const scale = maxEdge / longestEdge;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return original;
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), outputType, STORED_QUALITY);
    });

    if (!blob || blob.size >= file.size) {
      return original;
    }

    return { data: blob, type: outputType };
  } catch {
    return original;
  }
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
  const { data: body, type: bodyType } = await downscalePetPhoto(file);
  const ext = extensionForMime(bodyType);
  const filePath = `${shelterId}/${folderId}/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await withAsyncTimeout(
    supabase.storage.from(BUCKET).upload(filePath, body, {
      cacheControl: '3600',
      upsert: false,
      contentType: bodyType,
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
  if (blob.size > PET_PHOTO_MAX_INPUT_BYTES) {
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    return {
      url: '',
      error: `File size (${sizeMB}MB) exceeds the ${PET_PHOTO_MAX_INPUT_MB}MB limit.`,
    };
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
