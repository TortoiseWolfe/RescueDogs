/**
 * Client-side crop for pet listing photos (#273).
 * Output aspect matches browse cards (4:3).
 */

import type { CroppedAreaPixels } from '@/lib/avatar/types';

/** Browse card aspect in SpeciesBrowseView */
export const PET_PHOTO_ASPECT = 4 / 3;

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 900;
const WEBP_QUALITY = 0.88;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
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
