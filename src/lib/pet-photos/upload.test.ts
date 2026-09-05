import { describe, it, expect } from 'vitest';
import {
  downscalePetPhoto,
  extractPetPhotoPathFromUrl,
  PET_PHOTO_MAX_INPUT_BYTES,
  PET_PHOTO_MAX_INPUT_MB,
  validatePetPhotoFile,
} from './upload';

describe('pet-photos upload helpers', () => {
  it('rejects non-image MIME types', () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    expect(validatePetPhotoFile(file)).toMatch(/Invalid file type/i);
  });

  it('accepts jpeg under the input size limit', () => {
    const file = new File([new Uint8Array(100)], 'dog.jpg', {
      type: 'image/jpeg',
    });
    expect(validatePetPhotoFile(file)).toBeNull();
  });

  it(`rejects files over ${PET_PHOTO_MAX_INPUT_MB}MB (#284)`, () => {
    const file = new File([new Uint8Array(100)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(file, 'size', {
      value: PET_PHOTO_MAX_INPUT_BYTES + 1,
    });
    expect(validatePetPhotoFile(file)).toMatch(
      new RegExp(`${PET_PHOTO_MAX_INPUT_MB}MB limit`)
    );
  });

  it('extracts path from public URL', () => {
    const url =
      'https://abc.supabase.co/storage/v1/object/public/pet-photos/shelter-1/pet-1/123.jpg';
    expect(extractPetPhotoPathFromUrl(url)).toBe('shelter-1/pet-1/123.jpg');
  });

  it('leaves an image alone when it already fits the stored-edge cap', async () => {
    const file = new File([new Uint8Array(100)], 'dog.jpg', {
      type: 'image/jpeg',
    });
    const result = await downscalePetPhoto(file);
    expect(result.data).toBe(file);
    expect(result.type).toBe('image/jpeg');
  });

  it('re-encodes an oversized image to a smaller JPEG blob', async () => {
    const file = new File([new Uint8Array(100)], 'dog.jpg', {
      type: 'image/jpeg',
    });
    const result = await downscalePetPhoto(file, 200);
    expect(result.data).not.toBe(file);
    expect(result.data.size).toBeLessThan(file.size);
    expect(result.type).toBe('image/jpeg');
  });
});
