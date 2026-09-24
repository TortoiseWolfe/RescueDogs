import { describe, it, expect } from 'vitest';
import { normalizePetVideoUrl } from './pet-video-url';

describe('normalizePetVideoUrl (#326)', () => {
  it('returns null for empty input', () => {
    expect(normalizePetVideoUrl('')).toBeNull();
    expect(normalizePetVideoUrl('   ')).toBeNull();
    expect(normalizePetVideoUrl(null)).toBeNull();
  });

  it('accepts https YouTube / TikTok style URLs', () => {
    expect(
      normalizePetVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toMatch(/^https:\/\//);
    expect(normalizePetVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toMatch(
      /^https:\/\//
    );
  });

  it('rejects http and non-URLs', () => {
    expect(() => normalizePetVideoUrl('http://example.com/v')).toThrow(/https/);
    expect(() => normalizePetVideoUrl('not a url')).toThrow(/valid/);
  });
});
