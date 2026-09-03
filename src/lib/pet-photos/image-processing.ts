/**
 * Client-side crop for pet listing photos (#273).
 * Output aspect matches browse cards (4:3).
 * #284: downscale large phone photos before opening the cropper.
 */

import type { CroppedAreaPixels } from '@/lib/avatar/types';

/** Browse card aspect in SpeciesBrowseView */
export const PET_PHOTO_ASPECT = 4 / 3;

/** Long-edge cap for crop preview — keeps mobile cropper from freezing (#284). */
export const PET_PHOTO_PREVIEW_MAX_EDGE = 2000;

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 900;
const WEBP_QUALITY = 0.88;
const PREVIEW_JPEG_QUALITY = 0.92;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to resize photo for cropping'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Target width/height for the crop preview after optional downscale (#284).
 */
export function petPhotoPreviewTargetSize(
  width: number,
  height: number,
  maxEdge: number = PET_PHOTO_PREVIEW_MAX_EDGE
): { width: number; height: number; scaled: boolean } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width, height, scaled: false };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

/**
 * Prepare a selected file for the crop UI: downscale if the long edge exceeds
 * {@link PET_PHOTO_PREVIEW_MAX_EDGE}. Returns an object URL the caller must
 * revoke when the crop modal closes.
 */
export async function preparePetPhotoForCrop(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height, scaled } = petPhotoPreviewTargetSize(
      bitmap.width,
      bitmap.height
    );

    if (!scaled) {
      return URL.createObjectURL(file);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const previewBlob = await canvasToJpegBlob(canvas, PREVIEW_JPEG_QUALITY);
    return URL.createObjectURL(previewBlob);
  } finally {
    bitmap.close();
  }
}

export async function createCroppedPetPhoto(
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas to Blob conversion failed'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      WEBP_QUALITY
    );
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
