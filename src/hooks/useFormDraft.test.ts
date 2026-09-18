import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from './useFormDraft';

// `canUseCookies` reads the consent record straight out of localStorage, so mocking
// the module is both simpler and more honest than hand-writing a consent envelope
// that has to stay in step with consent-types.
vi.mock('@/utils/consent', () => ({
  canUseCookies: vi.fn(() => false),
}));

import { canUseCookies } from '@/utils/consent';
const mockCanUseCookies = vi.mocked(canUseCookies);

const KEY = 'draft:v1:test-form';

function storedIn(store: Storage) {
  const raw = store.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('useFormDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    mockCanUseCookies.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('where it writes', () => {
    it('uses localStorage when functional consent is granted', () => {
      mockCanUseCookies.mockReturnValue(true);
      const { rerender } = renderHook(({ v }) => useFormDraft('test-form', v), {
        initialProps: { v: { name: '' } },
      });

      rerender({ v: { name: 'Rocky' } });
      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(storedIn(localStorage)?.data).toEqual({ name: 'Rocky' });
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('falls back to sessionStorage when consent is denied, rather than not saving', () => {
      // The point of the fallback: sessionStorage still survives same-tab
      // navigation, which is the exact journey that loses people's work.
      mockCanUseCookies.mockReturnValue(false);
      const { rerender } = renderHook(({ v }) => useFormDraft('test-form', v), {
        initialProps: { v: { name: '' } },
      });

      rerender({ v: { name: 'Rocky' } });
      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(storedIn(sessionStorage)?.data).toEqual({ name: 'Rocky' });
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('forces sessionStorage for sensitive drafts even with consent granted', () => {
      // The adoption application carries a home address. A draft that outlives the
      // tab on a shared computer is worse than retyping the form.
      mockCanUseCookies.mockReturnValue(true);
      const { rerender } = renderHook(
        ({ v }) => useFormDraft('test-form', v, { sensitive: true }),
        { initialProps: { v: { address_line: '' } } }
      );

      rerender({ v: { address_line: '12 Example Street' } });
      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(storedIn(sessionStorage)?.data).toEqual({
        address_line: '12 Example Street',
      });
      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });

  describe('restoring', () => {
    it('returns null when there is no draft', () => {
      const { result } = renderHook(() =>
        useFormDraft('test-form', { name: '' })
      );
      expect(result.current.restored).toBeNull();
      expect(result.current.savedAt).toBeNull();
    });

    it('hands back a stored draft at mount', () => {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ v: 1, savedAt: Date.now(), data: { name: 'Rocky' } })
      );
      const { result } = renderHook(() =>
        useFormDraft('test-form', { name: '' })
      );
      expect(result.current.restored).toEqual({ name: 'Rocky' });
      expect(result.current.savedAt).toEqual(expect.any(Number));
    });

    it('discards a draft past its TTL and removes it', () => {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          v: 1,
          savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
          data: { name: 'Stale' },
        })
      );
      const { result } = renderHook(() =>
        useFormDraft('test-form', { name: '' })
      );
      expect(result.current.restored).toBeNull();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('discards a draft whose shape no longer validates', () => {
      // A form that crashes on its own restored draft is worse than no draft.
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ v: 1, savedAt: Date.now(), data: { legacy: true } })
      );
      const { result } = renderHook(() =>
        useFormDraft(
          'test-form',
          { name: '' },
          {
            validate: (v) =>
              typeof (v as { name?: unknown })?.name === 'string',
          }
        )
      );
      expect(result.current.restored).toBeNull();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('ignores an envelope from an older version', () => {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ v: 0, savedAt: Date.now(), data: { name: 'Old' } })
      );
      const { result } = renderHook(() =>
        useFormDraft('test-form', { name: '' })
      );
      expect(result.current.restored).toBeNull();
    });

    it('survives a corrupt payload without throwing', () => {
      sessionStorage.setItem(KEY, 'not json at all');
      expect(() =>
        renderHook(() => useFormDraft('test-form', { name: '' }))
      ).not.toThrow();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });
  });

  describe('not writing', () => {
    it('does not persist an untouched, empty form', () => {
      renderHook(() => useFormDraft('test-form', { name: '', breed: '' }));
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(sessionStorage.getItem(KEY)).toBeNull();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('does not immediately rewrite a draft it just restored', () => {
      const savedAt = Date.now() - 1000;
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ v: 1, savedAt, data: { name: 'Rocky' } })
      );
      const { rerender } = renderHook(({ v }) => useFormDraft('test-form', v), {
        initialProps: { v: { name: 'Rocky' } },
      });
      rerender({ v: { name: 'Rocky' } });
      act(() => {
        vi.advanceTimersByTime(900);
      });
      // Same savedAt => no write happened.
      expect(storedIn(sessionStorage)?.savedAt).toBe(savedAt);
    });

    it('is inert when disabled', () => {
      const { rerender } = renderHook(
        ({ v }) => useFormDraft('test-form', v, { enabled: false }),
        { initialProps: { v: { name: '' } } }
      );
      rerender({ v: { name: 'Rocky' } });
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('does not throw when storage refuses to write', () => {
      const spy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });

      const { rerender } = renderHook(({ v }) => useFormDraft('test-form', v), {
        initialProps: { v: { name: '' } },
      });
      rerender({ v: { name: 'Rocky' } });

      expect(() =>
        act(() => {
          vi.advanceTimersByTime(900);
        })
      ).not.toThrow();

      spy.mockRestore();
    });
  });

  describe('clearDraft', () => {
    it('removes the draft from both stores', () => {
      // Consent can change between the write and the clear; a draft stranded in the
      // store we are no longer reading is invisible to the app and still on the device.
      localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: 1, data: {} }));
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ v: 1, savedAt: 1, data: {} })
      );

      const { result } = renderHook(() =>
        useFormDraft('test-form', { name: '' })
      );
      act(() => {
        result.current.clearDraft();
      });

      expect(localStorage.getItem(KEY)).toBeNull();
      expect(sessionStorage.getItem(KEY)).toBeNull();
      expect(result.current.savedAt).toBeNull();
    });
  });
});
