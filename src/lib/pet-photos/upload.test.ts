import { describe, it, expect } from 'vitest';
import { extractPetPhotoPathFromUrl, validatePetPhotoFile } from './upload';

describe('pet-photos upload helpers', () => {
  it('rejects non-image MIME types', () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    expect(validatePetPhotoFile(file)).toMatch(/Invalid file type/i);
  });

  it('accepts jpeg under 5MB', () => {
    const file = new File([new Uint8Array(100)], 'dog.jpg', {
      type: 'image/jpeg',
    });
    expect(validatePetPhotoFile(file)).toBeNull();
  });

  it('extracts path from public URL', () => {
    const url =
      'https://abc.supabase.co/storage/v1/object/public/pet-photos/shelter-1/pet-1/123.jpg';
    expect(extractPetPhotoPathFromUrl(url)).toBe('shelter-1/pet-1/123.jpg');
  });
});
