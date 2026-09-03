'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { supabase } from '@/lib/supabase/client';
import {
  createCroppedPetPhoto,
  preparePetPhotoForCrop,
  PET_PHOTO_ASPECT,
} from '@/lib/pet-photos/image-processing';
import {
  clampPetPhotoZoom,
  computeFitWholeImageZoom,
  PET_PHOTO_MAX_ZOOM,
  PET_PHOTO_MIN_ZOOM,
} from '@/lib/pet-photos/crop-zoom';
import {
  PET_PHOTO_MAX_INPUT_MB,
  uploadPetPhotoBlob,
  validatePetPhotoFile,
} from '@/lib/pet-photos/upload';
import {
  MAX_PET_PHOTOS,
  PetPhotoService,
} from '@/services/applications/pet-photo-service';
import type { PetPhoto } from '@/types/applications';

type StagedPhoto = {
  id: string;
  preview: string;
  blob: Blob;
};

export type PetPhotoManagerHandle = {
  uploadStaged: (petId: string) => Promise<void>;
  hasStagedPhotos: () => boolean;
};

type PetPhotoManagerProps = {
  shelterId: string;
  /** When null, photos are staged until parent creates the pet. */
  petId: string | null;
  initialPhotos?: PetPhoto[];
  /** Shown when gallery rows are empty but pets.photo_url exists (pre-#273). */
  legacyPhotoUrl?: string | null;
  onStagedChange?: (count: number) => void;
  disabled?: boolean;
};

/**
 * Up to 4 pet photos with crop-before-upload (#273).
 */
export const PetPhotoManager = forwardRef<
  PetPhotoManagerHandle,
  PetPhotoManagerProps
>(function PetPhotoManager(
  {
    shelterId,
    petId,
    initialPhotos = [],
    legacyPhotoUrl,
    onStagedChange,
    disabled = false,
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cropPreviewUrlRef = useRef<string | null>(null);
  const [photos, setPhotos] = useState<PetPhoto[]>(initialPhotos);
  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showLegacyPhoto =
    petId && photos.length === 0 && Boolean(legacyPhotoUrl?.trim());
  const totalCount = petId
    ? photos.length + (showLegacyPhoto ? 1 : 0)
    : staged.length;
  const canAddMore = totalCount < MAX_PET_PHOTOS && !disabled && !busy;

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    onStagedChange?.(staged.length);
  }, [staged.length, onStagedChange]);

  useEffect(() => {
    return () => {
      if (cropPreviewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(cropPreviewUrlRef.current);
        cropPreviewUrlRef.current = null;
      }
    };
  }, []);

  function revokeCropPreview() {
    if (cropPreviewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(cropPreviewUrlRef.current);
    }
    cropPreviewUrlRef.current = null;
  }

  useImperativeHandle(
    ref,
    () => ({
      hasStagedPhotos: () => staged.length > 0,
      uploadStaged: async (newPetId: string) => {
        if (staged.length === 0) return;
        const service = new PetPhotoService(supabase);
        for (let i = 0; i < staged.length; i++) {
          const item = staged[i];
          const uploaded = await uploadPetPhotoBlob(
            shelterId,
            newPetId,
            item.blob
          );
          if (uploaded.error) {
            throw new Error(uploaded.error);
          }
          await service.addPhoto(newPetId, uploaded.url, i);
          URL.revokeObjectURL(item.preview);
        }
        await service.syncPrimaryPhotoUrl(newPetId);
        setStaged([]);
      },
    }),
    [shelterId, staged]
  );

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const onMediaLoaded = useCallback(
    (mediaSize: { naturalWidth: number; naturalHeight: number }) => {
      const fitZoom = computeFitWholeImageZoom(
        mediaSize.naturalWidth,
        mediaSize.naturalHeight,
        PET_PHOTO_ASPECT
      );
      setZoom(fitZoom);
      setCrop({ x: 0, y: 0 });
    },
    []
  );

  function openFilePicker() {
    if (!canAddMore) return;
    inputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validatePetPhotoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      revokeCropPreview();
      const previewUrl = await preparePetPhotoForCrop(file);
      cropPreviewUrlRef.current = previewUrl;
      setImageSrc(previewUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open that photo. Try a smaller image.'
      );
    } finally {
      setBusy(false);
    }
  }

  function closeCropModal() {
    revokeCropPreview();
    setImageSrc(null);
    setCroppedAreaPixels(null);
  }

  async function confirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await createCroppedPetPhoto(imageSrc, croppedAreaPixels);

      if (!petId) {
        const preview = URL.createObjectURL(blob);
        setStaged((prev) => [
          ...prev,
          { id: crypto.randomUUID(), preview, blob },
        ]);
        closeCropModal();
        return;
      }

      const uploaded = await uploadPetPhotoBlob(shelterId, petId, blob);
      if (uploaded.error) {
        setError(uploaded.error);
        return;
      }

      const service = new PetPhotoService(supabase);
      const nextOrder = photos.length;
      const row = await service.addPhoto(petId, uploaded.url, nextOrder);
      await service.syncPrimaryPhotoUrl(petId);
      setPhotos((prev) => [...prev, row]);
      closeCropModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process photo.');
    } finally {
      setBusy(false);
    }
  }

  async function removePersisted(photo: PetPhoto) {
    if (!petId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const service = new PetPhotoService(supabase);
      await service.deletePhoto(photo.id);
      const remaining = photos
        .filter((p) => p.id !== photo.id)
        .map((p) => p.id);
      if (remaining.length > 0) {
        await service.reorderPhotos(petId, remaining);
      } else {
        await service.syncPrimaryPhotoUrl(petId);
      }
      const refreshed = await service.listPhotos(petId);
      setPhotos(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo.');
    } finally {
      setBusy(false);
    }
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function makePrimary(photoId: string) {
    if (!petId || busy) return;
    const order = photos.map((p) => p.id);
    const idx = order.indexOf(photoId);
    if (idx <= 0) return;
    order.splice(idx, 1);
    order.unshift(photoId);
    setBusy(true);
    setError(null);
    try {
      const service = new PetPhotoService(supabase);
      await service.reorderPhotos(petId, order);
      const refreshed = await service.listPhotos(petId);
      setPhotos(refreshed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update photo order.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-text">
          Photos ({totalCount}/{MAX_PET_PHOTOS}) — JPEG, PNG, or WebP, max{' '}
          {PET_PHOTO_MAX_INPUT_MB}MB (large photos are resized automatically)
        </span>
        {canAddMore && (
          <button
            type="button"
            className="btn btn-outline btn-sm min-h-11"
            onClick={openFilePicker}
          >
            Add photo
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFileSelected(e)}
        aria-label="Add pet photo"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {petId ? (
          <>
            {showLegacyPhoto && (
              <div className="border-base-300 relative overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={legacyPhotoUrl!}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
                <span className="badge badge-primary badge-sm absolute top-1 left-1">
                  Profile
                </span>
                <p className="bg-base-100/90 text-base-content/70 p-2 text-xs">
                  Add a photo below to manage the gallery.
                </p>
              </div>
            )}
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="border-base-300 relative overflow-hidden rounded-lg border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
                {index === 0 && (
                  <span className="badge badge-primary badge-sm absolute top-1 left-1">
                    Profile
                  </span>
                )}
                <div className="bg-base-100/90 flex flex-wrap gap-1 p-1">
                  {index > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs min-h-8"
                      onClick={() => void makePrimary(photo.id)}
                      disabled={busy}
                    >
                      Make profile
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error min-h-8"
                    onClick={() => void removePersisted(photo)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          staged.map((item, index) => (
            <div
              key={item.id}
              className="border-base-300 relative overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
              {index === 0 && (
                <span className="badge badge-primary badge-sm absolute top-1 left-1">
                  Profile
                </span>
              )}
              <div className="bg-base-100/90 p-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error min-h-8"
                  onClick={() => removeStaged(item.id)}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {imageSrc && (
        <dialog
          open
          className="modal modal-open"
          aria-labelledby="pet-crop-title"
        >
          <div className="modal-box max-w-2xl">
            <h3 id="pet-crop-title" className="mb-4 text-lg font-bold">
              Crop photo for listing
            </h3>
            <p className="text-base-content/70 mb-3 text-sm">
              Drag to reposition. Zoom out to include more of the photo — saved
              images use the same 4:3 shape as browse cards.
            </p>
            <div className="bg-base-200 relative mb-4 h-80 overflow-hidden rounded-lg sm:h-[28rem]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={PET_PHOTO_ASPECT}
                minZoom={PET_PHOTO_MIN_ZOOM}
                maxZoom={PET_PHOTO_MAX_ZOOM}
                onCropChange={setCrop}
                onZoomChange={(value) => setZoom(clampPetPhotoZoom(value))}
                onCropComplete={onCropComplete}
                onMediaLoaded={onMediaLoaded}
              />
            </div>
            <label className="mb-4 flex flex-col gap-2">
              <span className="text-sm font-medium">Zoom</span>
              <input
                type="range"
                min={PET_PHOTO_MIN_ZOOM}
                max={PET_PHOTO_MAX_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(e) =>
                  setZoom(clampPetPhotoZoom(Number(e.target.value)))
                }
                className="range range-primary"
                aria-label="Zoom"
                aria-valuemin={PET_PHOTO_MIN_ZOOM}
                aria-valuemax={PET_PHOTO_MAX_ZOOM}
                aria-valuenow={zoom}
              />
            </label>
            <div className="modal-action flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost min-h-11"
                onClick={closeCropModal}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-11"
                onClick={() => void confirmCrop()}
                disabled={busy || !croppedAreaPixels}
              >
                {busy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Use photo'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeCropModal}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
});
