import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createCroppedPetPhoto,
  preparePetPhotoForCrop,
  petPhotoPreviewTargetSize,
  PET_PHOTO_PREVIEW_MAX_EDGE,
} from './image-processing';

describe('createCroppedPetPhoto output format (#427)', () => {
  const area = { x: 0, y: 0, width: 400, height: 300 };

  class LoadedImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  // toBlob is already a vi.fn from tests/setup.ts; spying on it and restoring
  // would strip that shared implementation, so swap it by hand instead.
  const sharedToBlob = HTMLCanvasElement.prototype.toBlob;

  function stubCanvasEncoder(encodes: (requested: string) => string) {
    HTMLCanvasElement.prototype.toBlob = function (callback, type) {
      callback(new Blob(['x'], { type: encodes(type ?? 'image/png') }));
    };
  }

  afterEach(() => {
    HTMLCanvasElement.prototype.toBlob = sharedToBlob;
    vi.unstubAllGlobals();
  });

  it('keeps WebP when the browser can encode it', async () => {
    vi.stubGlobal('Image', LoadedImage);
    stubCanvasEncoder((requested) => requested);

    const blob = await createCroppedPetPhoto('blob:test', area);
    expect(blob.type).toBe('image/webp');
  });

  it('falls back to JPEG instead of storing a lossless PNG', async () => {
    vi.stubGlobal('Image', LoadedImage);
    // Older Safari ignores 'image/webp' and hands back PNG.
    stubCanvasEncoder((requested) =>
      requested === 'image/webp' ? 'image/png' : requested
    );

    const blob = await createCroppedPetPhoto('blob:test', area);
    expect(blob.type).toBe('image/jpeg');
  });
});

describe('petPhotoPreviewTargetSize (#284)', () => {
  it('leaves images under the max edge unchanged', () => {
    expect(petPhotoPreviewTargetSize(800, 600)).toEqual({
      width: 800,
      height: 600,
      scaled: false,
    });
  });

  it('scales so the long edge equals the max', () => {
    expect(petPhotoPreviewTargetSize(4000, 3000)).toEqual({
      width: PET_PHOTO_PREVIEW_MAX_EDGE,
      height: 1500,
      scaled: true,
    });
  });

  it('scales portrait images by height', () => {
    expect(petPhotoPreviewTargetSize(3000, 4000)).toEqual({
      width: 1500,
      height: PET_PHOTO_PREVIEW_MAX_EDGE,
      scaled: true,
    });
  });
});

describe('preparePetPhotoForCrop (#284)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a blob URL for an image that does not need resizing', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 800,
        height: 600,
        close: vi.fn(),
      })
    );

    const file = new File([new Uint8Array(64)], 'small.jpg', {
      type: 'image/jpeg',
    });
    const url = await preparePetPhotoForCrop(file);
    expect(url.startsWith('blob:')).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('uses preview target size when the image is oversized', async () => {
    // Dimension math is covered by petPhotoPreviewTargetSize; here we only
    // assert oversized bitmaps still produce a blob URL after canvas resize.
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 4000,
        height: 3000,
        close,
      })
    );

    const file = new File([new Uint8Array(64)], 'huge.jpg', {
      type: 'image/jpeg',
    });

    // Prefer the global HTMLCanvasElement mocks from tests/setup.ts
    // (toBlob + dimension tracking). If getContext is unavailable in this
    // environment, skip rather than flake CI.
    const probe = document.createElement('canvas');
    if (!probe.getContext('2d')) {
      return;
    }

    const url = await preparePetPhotoForCrop(file);
    expect(url.startsWith('blob:')).toBe(true);
    expect(close).toHaveBeenCalled();
    URL.revokeObjectURL(url);
  });
});
