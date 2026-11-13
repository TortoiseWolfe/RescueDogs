/**
 * Find pet-photo files that no database row points at (#372).
 * Pure logic, so the sweep script and its test share it.
 */

export interface StoredPhotoObject {
  /** Path inside the `pet-photos` bucket: `{shelterId}/{petId}/{file}`. */
  path: string;
  createdAt: string;
}

/** Same rule as extractPetPhotoPathFromUrl, without importing the Supabase client. */
function pathFromUrl(url: string): string {
  return url.split('/pet-photos/')[1] ?? '';
}

/**
 * Objects older than `minAgeMs` that no url in `referencedUrls` points at.
 * The age floor protects a file whose upload finished a moment before its
 * row insert (the normal order of an upload).
 */
export function findOrphanedPhotos(
  objects: readonly StoredPhotoObject[],
  referencedUrls: ReadonlyArray<string | null | undefined>,
  now: Date,
  minAgeMs = 24 * 60 * 60 * 1000
): StoredPhotoObject[] {
  const referenced = new Set(
    referencedUrls
      .filter((url): url is string => Boolean(url))
      .map(pathFromUrl)
      .filter(Boolean)
  );
  return objects.filter((object) => {
    if (referenced.has(object.path)) return false;
    const age = now.getTime() - new Date(object.createdAt).getTime();
    return Number.isFinite(age) && age >= minAgeMs;
  });
}
