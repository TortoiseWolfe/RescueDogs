import { describe, it, expect } from 'vitest';
import { selectPetPhotos } from './selection';

function photo(name: string, type = 'image/jpeg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('selectPetPhotos (#338)', () => {
  it('accepts every picked photo when they all fit', () => {
    const files = [photo('a.jpg'), photo('b.png', 'image/png')];
    const result = selectPetPhotos(files, 4, 4);

    expect(result.accepted.map((f) => f.name)).toEqual(['a.jpg', 'b.png']);
    expect(result.notices).toEqual([]);
  });

  it('keeps the first photos that fit and explains the rest', () => {
    const files = ['1', '2', '3', '4', '5', '6'].map((n) => photo(`${n}.jpg`));
    const result = selectPetPhotos(files, 3, 4);

    expect(result.accepted.map((f) => f.name)).toEqual([
      '1.jpg',
      '2.jpg',
      '3.jpg',
    ]);
    expect(result.notices).toEqual([
      'Only 3 more photos fit (4 max), so the first 3 were used.',
    ]);
  });

  it('uses singular wording for one remaining slot', () => {
    const result = selectPetPhotos([photo('a.jpg'), photo('b.jpg')], 1, 4);

    expect(result.accepted).toHaveLength(1);
    expect(result.notices).toEqual([
      'Only 1 more photo fits (4 max), so the first 1 was used.',
    ]);
  });

  it('skips invalid files without losing the valid ones', () => {
    const files = [
      photo('notes.pdf', 'application/pdf'),
      photo('dog.webp', 'image/webp'),
    ];
    const result = selectPetPhotos(files, 4, 4);

    expect(result.accepted.map((f) => f.name)).toEqual(['dog.webp']);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]).toMatch(/^Skipped notes\.pdf: Invalid file type/);
  });

  it('does not count invalid files against the remaining slots', () => {
    const files = [
      photo('bad.gif', 'image/gif'),
      photo('a.jpg'),
      photo('b.jpg'),
    ];
    const result = selectPetPhotos(files, 2, 4);

    expect(result.accepted.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('accepts nothing when the gallery is already full', () => {
    const result = selectPetPhotos([photo('a.jpg')], 0, 4);

    expect(result.accepted).toEqual([]);
    expect(result.notices).toEqual([
      'This pet already has the maximum of 4 photos.',
    ]);
  });
});
