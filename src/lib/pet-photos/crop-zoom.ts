/** Minimum zoom — below 1 lets users include more of tall/wide originals. */
export const PET_PHOTO_MIN_ZOOM = 0.25;

export const PET_PHOTO_MAX_ZOOM = 3;

/**
 * Zoom level that fits the entire image inside a fixed-aspect crop area.
 * Values below 1 mean the image is shrunk so nothing is clipped initially.
 */
export function computeFitWholeImageZoom(
  naturalWidth: number,
  naturalHeight: number,
  cropAspect: number
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || cropAspect <= 0) {
    return 1;
  }

  const mediaAspect = naturalWidth / naturalHeight;

  const fitZoom =
    mediaAspect >= cropAspect
      ? cropAspect / mediaAspect
      : mediaAspect / cropAspect;

  return Math.min(1, Math.max(PET_PHOTO_MIN_ZOOM, fitZoom));
}

export function clampPetPhotoZoom(zoom: number): number {
  return Math.min(PET_PHOTO_MAX_ZOOM, Math.max(PET_PHOTO_MIN_ZOOM, zoom));
}
