'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { canUseCookies } from '@/utils/consent';
import { CookieCategory } from '@/utils/consent-types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hooks:form-draft');

/**
 * Keep an in-progress form on the device so navigating away does not destroy it.
 *
 * WHY THIS EXISTS (#310). A rescue evaluating the product left the Add Pet page to
 * fetch photos and a bio — the ordinary way anyone fills this form — and came back to
 * eight blank fields. They restarted the listing three times before writing in. There
 * was no draft code anywhere in the repository: no persistence hook, no
 * `beforeunload` handler, no unsaved-changes guard. Nothing had broken; nothing had
 * ever been built.
 *
 * CONSENT IS A STORAGE CHOICE, NOT AN ON/OFF SWITCH. A draft is FUNCTIONAL-category
 * data. Without that consent we fall back to `sessionStorage` rather than skipping
 * persistence, because `sessionStorage` still survives same-tab navigation — which is
 * the entire journey that loses people's work. The localStorage-else-sessionStorage
 * shape is copied from `ThemeSwitcher` (`src/components/theme/ThemeSwitcher.tsx`),
 * which is the house pattern; there is no central consent wrapper to defer to.
 *
 * `sensitive` FORCES sessionStorage whatever the consent says. The adoption
 * application carries a home address and phone number, and a draft that outlives the
 * tab on a shared or library computer is a worse failure than retyping a form. Pet
 * listings are not personal data and take the normal path.
 *
 * EVERY ACCESS IS GUARDED. Private mode, blocked site data and quota errors all throw
 * on access rather than returning empty, and a form that explodes because it could not
 * save a draft is worse than one that silently does not save. Nothing here may throw.
 */

/** Bump when the envelope shape changes; old drafts are then ignored, not crashed on. */
const ENVELOPE_VERSION = 1;
const KEY_PREFIX = 'draft:v1:';
const DEFAULT_DEBOUNCE_MS = 800;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

export interface UseFormDraftOptions<T> {
  /** Set false to disable entirely (e.g. while the form is still loading server state). */
  enabled?: boolean;
  debounceMs?: number;
  ttlMs?: number;
  /** Force sessionStorage regardless of consent. Use for anything personally identifying. */
  sensitive?: boolean;
  /** Reject a restored payload that no longer matches the form's shape. */
  validate?: (value: unknown) => boolean;
  /** Decide whether a value is worth persisting. Default: any non-empty field. */
  shouldSave?: (value: T) => boolean;
}

export interface UseFormDraftResult<T> {
  /** The stored draft found at mount, or null. Read once; it does not change. */
  restored: T | null;
  /** Epoch ms of the last successful write, for a "Draft saved" affordance. */
  savedAt: number | null;
  /** Remove the draft. Call on successful submit and from a Discard control. */
  clearDraft: () => void;
}

/** Any string with content, any non-zero number, any true — otherwise not worth saving. */
function hasContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasContent);
  if (typeof value === 'object') return Object.values(value).some(hasContent);
  return false;
}

function pickStorage(sensitive: boolean): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sensitive && canUseCookies(CookieCategory.FUNCTIONAL)) {
      return window.localStorage;
    }
    return window.sessionStorage;
  } catch {
    // Accessing the accessor itself can throw with site data blocked.
    return null;
  }
}

/**
 * Clear a draft from outside the component that owns the hook.
 *
 * Needed because success is not always known where the form lives. `/adopt` submits
 * through a parent whose handler CATCHES its own errors and sets a message — so a
 * form that cleared the draft after awaiting that handler would throw away a
 * seventeen-field application precisely when submission had failed. The parent clears
 * on its own success path instead.
 */
export function clearFormDraft(key: string): void {
  if (typeof window === 'undefined') return;
  const storageKey = `${KEY_PREFIX}${key}`;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      store.removeItem(storageKey);
    } catch {
      /* private mode / blocked site data */
    }
  }
}

export function useFormDraft<T>(
  key: string,
  value: T,
  options: UseFormDraftOptions<T> = {}
): UseFormDraftResult<T> {
  const {
    enabled = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    ttlMs = DEFAULT_TTL_MS,
    sensitive = false,
    validate,
    shouldSave,
  } = options;

  const storageKey = `${KEY_PREFIX}${key}`;

  const [restored, setRestored] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /** Guards the write effect until the mount read has run, so a fresh render of empty
   *  defaults cannot overwrite a stored draft before the consumer restores it. */
  const readDone = useRef(false);
  /** Last payload actually written, so restoring a draft does not rewrite it. */
  const lastWritten = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Form value at the moment the read ran: hydration, not typing. Never persisted. */
  const baseline = useRef<string | null>(null);

  const clearDraft = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    lastWritten.current = null;
    setSavedAt(null);
    // Clear BOTH stores: consent can change between the write and the clear, and a
    // draft left behind in the store we are no longer using is the worst outcome —
    // invisible to the app, still on the device.
    if (typeof window === 'undefined') return;
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        store.removeItem(storageKey);
      } catch {
        /* private mode / blocked site data — nothing to do and nothing to report */
      }
    }
  }, [storageKey]);

  // Debounced write whenever the serialised value changes.
  const serialized = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return null; // non-serialisable (a File, a cycle) — never persisted
    }
  })();

  // Read when the key becomes available, and again if it changes.
  //
  // NOT mount-only: /shelter/pets/edit reads its pet id from ?id= AFTER mount (static
  // export has no dynamic segment), so the draft key does not exist on the first
  // render. A mount-only read would silently never find that pet's draft.
  useEffect(() => {
    readDone.current = false;
    baseline.current = serialized;
    setRestored(null);
    setSavedAt(null);
    lastWritten.current = null;

    if (!enabled) {
      readDone.current = true;
      return;
    }
    const store = pickStorage(sensitive);
    if (!store) {
      readDone.current = true;
      return;
    }
    try {
      const raw = store.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftEnvelope<T>;
        const fresh =
          parsed?.v === ENVELOPE_VERSION &&
          typeof parsed.savedAt === 'number' &&
          Date.now() - parsed.savedAt < ttlMs;
        const shapeOk = !validate || validate(parsed?.data);

        if (fresh && shapeOk) {
          setRestored(parsed.data);
          setSavedAt(parsed.savedAt);
          lastWritten.current = JSON.stringify(parsed.data);
        } else {
          // Stale or unrecognised. Drop it rather than hand the form something it
          // cannot render — a draft that breaks the page is worse than no draft.
          store.removeItem(storageKey);
        }
      }
    } catch (error) {
      logger.debug('Could not read draft', { key: storageKey, error });
      try {
        store.removeItem(storageKey);
      } catch {
        /* nothing further to try */
      }
    } finally {
      readDone.current = true;
    }
    // `ttlMs`/`validate` are read-only inputs to this pass; re-running on their
    // identity would re-read the draft on every render for an inline validator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled, sensitive]);

  useEffect(() => {
    if (!enabled || !readDone.current || serialized == null) return;
    if (serialized === lastWritten.current) return;
    if (serialized === baseline.current) return;

    const keep = shouldSave ? shouldSave(value) : hasContent(value);
    if (!keep) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const store = pickStorage(sensitive);
      if (!store) return;
      const envelope: DraftEnvelope<T> = {
        v: ENVELOPE_VERSION,
        savedAt: Date.now(),
        data: value,
      };
      try {
        store.setItem(storageKey, JSON.stringify(envelope));
        lastWritten.current = serialized;
        baseline.current = null;
        setSavedAt(envelope.savedAt);
      } catch (error) {
        // Quota is the realistic case. Do not retry and do not surface it: the form
        // still works, and an error toast about a failed autosave teaches people to
        // ignore toasts.
        logger.debug('Could not write draft', { key: storageKey, error });
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // `value` is covered by `serialized`; depending on the object identity would
    // re-run on every render for a literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, sensitive, storageKey, debounceMs]);

  return { restored, savedAt, clearDraft };
}
