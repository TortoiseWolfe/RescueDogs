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
} from '@/lib/pet-photos/upload';
import { selectPetPhotos } from '@/lib/pet-photos/selection';
import { moveIdBy } from '@/lib/pet-photos/order';
import {
  MAX_PET_PHOTOS,
  PetPhotoService,
} from '@/services/applications/pet-photo-service';
import type { PetPhoto } from '@/types/applications';
import {
  clearStagedPhotos,
  loadStagedPhotos,
  pruneExpiredStagedPhotos,
  saveStagedPhotos,
} from '@/lib/pet-photos/staged-draft';

// Must be a stable reference: an inline `[]` default gives the initialPhotos sync
// effect a new array on every re-render, so it sets state and re-renders forever
// (Add Pet passes no photos).
const NO_PHOTOS: PetPhoto[] = [];

type StagedPhoto = {
  id: string;
  preview: string;
  blob: Blob;
};

export type PetPhotoManagerHandle = {
  uploadStaged: (petId: string) => Promise<void>;
  hasStagedPhotos: () => boolean;
  /**
   * Drop everything staged, on screen and in IndexedDB (#310).
   *
   * "Discard draft" used to clear only the stored rows, so the photos stayed visible
   * and the save effect immediately wrote them back — the discard undid itself.
   */
  clearStaged: () => Promise<void>;
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
  /**
   * Persist staged photos against this key while the pet does not exist yet (#310).
   * Omit to keep the old in-memory-only behaviour.
   */
  draftKey?: string | null;
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
    initialPhotos = NO_PHOTOS,
    legacyPhotoUrl,
    onStagedChange,
    disabled = false,
    draftKey = null,
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
  const [notice, setNotice] = useState<string | null>(null);
  /** Files picked together, cropped one after another (#338). */
  const [cropQueue, setCropQueue] = useState<{
    files: File[];
    index: number;
  } | null>(null);

  const showLegacyPhoto =
    petId && photos.length === 0 && Boolean(legacyPhotoUrl?.trim());
  const totalCount = petId
    ? photos.length + (showLegacyPhoto ? 1 : 0)
    : staged.length;
  const canAddMore = totalCount < MAX_PET_PHOTOS && !disabled && !busy;
  const queueSize = cropQueue?.files.length ?? 0;
  const queuePosition = (cropQueue?.index ?? 0) + 1;

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    onStagedChange?.(staged.length);
  }, [staged.length, onStagedChange]);

  /**
   * #310: staged photos are binary and used to die with the document, so leaving the
   * page to fetch a second photo destroyed the first. Only meaningful before the pet
   * exists — once `petId` is set, photos upload immediately and live on the server.
   */
  const startedPhotoRestore = useRef(false);
  // State, not a ref: the save effect below must re-run once the read finishes, and
  // it must NOT run before then or it would save `[]` over the rows being read.
  const [photoDraftRead, setPhotoDraftRead] = useState(false);
  const persistDraft = Boolean(draftKey) && petId === null;

  useEffect(() => {
    if (!persistDraft || !draftKey || startedPhotoRestore.current) return;
    startedPhotoRestore.current = true;
    let cancelled = false;
    const created: string[] = [];

    void (async () => {
      await pruneExpiredStagedPhotos();
      const rows = await loadStagedPhotos(draftKey);
      if (cancelled) return;
      if (rows.length > 0) {
        // The stored object URL is dead in this document; mint a fresh one per blob.
        const revived = rows.map((row) => {
          const preview = URL.createObjectURL(row.blob);
          created.push(preview);
          return { id: row.photoId, preview, blob: row.blob };
        });
        if (cancelled) {
          created.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        setStaged((prev) => (prev.length > 0 ? prev : revived));
      }
      setPhotoDraftRead(true);
    })();

    return () => {
      cancelled = true;
      // Previews minted here are owned by this effect. Without this they leak for the
      // life of the document every time the page is revisited.
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [persistDraft, draftKey, petId]);

  useEffect(() => {
    if (!persistDraft || !draftKey || !photoDraftRead) return;
    void saveStagedPhotos(
      draftKey,
      staged.map((item) => ({ photoId: item.id, blob: item.blob }))
    );
  }, [persistDraft, draftKey, photoDraftRead, staged]);

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
      clearStaged: async () => {
        staged.forEach((item) => URL.revokeObjectURL(item.preview));
        setStaged([]);
        if (draftKey) await clearStagedPhotos(draftKey);
      },
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
        // On the server now — a surviving draft would re-add them as duplicates.
        if (draftKey) await clearStagedPhotos(draftKey);
        setStaged([]);
      },
    }),
    [shelterId, staged, draftKey]
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

  /**
   * Open the crop step for `files[index]`, skipping past any that cannot be
   * read so one bad image does not strand the rest of the selection.
   */
  async function openQueuedPhoto(files: File[], index: number) {
    for (let i = index; i < files.length; i++) {
      try {
        revokeCropPreview();
        const previewUrl = await preparePetPhotoForCrop(files[i]);
        cropPreviewUrlRef.current = previewUrl;
        setCropQueue({ files, index: i });
        setImageSrc(previewUrl);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
        return;
      } catch (err) {
        const reason =
          err instanceof Error
            ? err.message
            : 'Could not open that photo. Try a smaller image.';
        setNotice((prev) =>
          [prev, `Skipped ${files[i].name}: ${reason}`]
            .filter(Boolean)
            .join(' ')
        );
      }
    }
    setCropQueue(null);
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;

    const { accepted, notices } = selectPetPhotos(
      picked,
      MAX_PET_PHOTOS - totalCount,
      MAX_PET_PHOTOS
    );
    setError(null);
    setNotice(notices.length > 0 ? notices.join(' ') : null);
    if (accepted.length === 0) return;

    setBusy(true);
    try {
      await openQueuedPhoto(accepted, 0);
    } finally {
      setBusy(false);
    }
  }

  function closeCropModal() {
    revokeCropPreview();
    setImageSrc(null);
    setCroppedAreaPixels(null);
  }

  function cancelCropQueue() {
    closeCropModal();
    setCropQueue(null);
  }

  /** Move on to the next picked photo, or finish when none are left. */
  async function advanceCropQueue() {
    closeCropModal();
    const queue = cropQueue;
    if (queue && queue.index + 1 < queue.files.length) {
      await openQueuedPhoto(queue.files, queue.index + 1);
    } else {
      setCropQueue(null);
    }
  }

  async function skipQueuedPhoto() {
    setBusy(true);
    setError(null);
    try {
      await advanceCropQueue();
    } finally {
      setBusy(false);
    }
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
        await advanceCropQueue();
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
      await advanceCropQueue();
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

  async function applyPersistedOrder(order: string[]) {
    if (!petId) return;
    const unchanged = order.every((id, i) => id === photos[i]?.id);
    if (unchanged) return;
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

  async function movePersisted(photoId: string, delta: -1 | 1) {
    if (!petId || busy) return;
    await applyPersistedOrder(
      moveIdBy(
        photos.map((p) => p.id),
        photoId,
        delta
      )
    );
  }

  function moveStaged(id: string, delta: -1 | 1) {
    if (busy) return;
    setStaged((prev) => {
      const nextIds = moveIdBy(
        prev.map((item) => item.id),
        id,
        delta
      );
      return nextIds
        .map((nextId) => prev.find((item) => item.id === nextId))
        .filter((item): item is StagedPhoto => Boolean(item));
    });
  }

  async function makePrimary(photoId: string) {
    if (!petId || busy) return;
    const order = photos.map((p) => p.id);
    const idx = order.indexOf(photoId);
    if (idx <= 0) return;
    order.splice(idx, 1);
    order.unshift(photoId);
    await applyPersistedOrder(order);
  }

  function orderButtons(
    index: number,
    total: number,
    onMove: (delta: -1 | 1) => void
  ) {
    if (total < 2) return null;
    return (
      <>
        <button
          type="button"
          className="btn btn-ghost btn-xs min-h-11 min-w-11"
          aria-label="Move earlier"
          onClick={() => onMove(-1)}
          disabled={busy || index === 0}
        >
          Earlier
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs min-h-11 min-w-11"
          aria-label="Move later"
          onClick={() => onMove(1)}
          disabled={busy || index === total - 1}
        >
          Later
        </button>
      </>
    );
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
            {MAX_PET_PHOTOS - totalCount > 1 ? 'Add photos' : 'Add photo'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void onFileSelected(e)}
        aria-label="Add pet photos"
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
                  {orderButtons(
                    index,
                    photos.length,
                    (delta) => void movePersisted(photo.id, delta)
                  )}
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
              <div className="bg-base-100/90 flex flex-wrap gap-1 p-1">
                {orderButtons(index, staged.length, (delta) =>
                  moveStaged(item.id, delta)
                )}
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

      {notice && (
        <div role="status" className="alert">
          <span>{notice}</span>
        </div>
      )}

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
              {queueSize > 1 && (
                <span className="text-base-content/70 ml-2 text-base font-normal">
                  Photo {queuePosition} of {queueSize}
                </span>
              )}
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
                onClick={cancelCropQueue}
                disabled={busy}
              >
                {queueSize > 1 ? 'Cancel all' : 'Cancel'}
              </button>
              {queueSize > 1 && (
                <button
                  type="button"
                  className="btn btn-outline min-h-11"
                  onClick={() => void skipQueuedPhoto()}
                  disabled={busy}
                >
                  Skip this photo
                </button>
              )}
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
            <button type="button" onClick={cancelCropQueue}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
});
