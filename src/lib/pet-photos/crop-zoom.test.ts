import { describe, it, expect } from 'vitest';
import {
  PET_PHOTO_MIN_ZOOM,
  computeFitWholeImageZoom,
  clampPetPhotoZoom,
} from './crop-zoom';
import { PET_PHOTO_ASPECT } from './image-processing';

describe('crop-zoom', () => {
  it('fits portrait originals below zoom 1 for 4:3 crop', () => {
    const zoom = computeFitWholeImageZoom(1200, 1600, PET_PHOTO_ASPECT);
    expect(zoom).toBeLessThan(1);
    expect(zoom).toBeGreaterThanOrEqual(PET_PHOTO_MIN_ZOOM);
  });

  it('fits wide landscape originals below zoom 1 for 4:3 crop', () => {
    const zoom = computeFitWholeImageZoom(1920, 1080, PET_PHOTO_ASPECT);
    expect(zoom).toBeLessThan(1);
  });

  it('returns 1 for image already matching crop aspect', () => {
    expect(computeFitWholeImageZoom(400, 300, PET_PHOTO_ASPECT)).toBe(1);
  });

  it('clamps zoom to configured bounds', () => {
    expect(clampPetPhotoZoom(0.1)).toBe(PET_PHOTO_MIN_ZOOM);
    expect(clampPetPhotoZoom(5)).toBe(3);
    expect(clampPetPhotoZoom(1)).toBe(1);
  });
});
