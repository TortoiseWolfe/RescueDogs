/**
 * Unit tests for useApplicationRealtime — the realtime subscription that
 * keeps the application status tracker live.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const APP_ID = '55555555-5555-5555-5555-555555555501';
const APP_ROW = {
  id: APP_ID,
  status: 'submitted',
  pets: { name: 'Biscuit' },
  application_status_history: [],
};

// Capture each postgres_changes handler (keyed by table) plus the subscribe
// status callback so tests can drive data-change and connection-status paths.
let changeHandlers: Record<string, (payload: unknown) => void> = {};
let statusCb: ((status: string) => void) | null = null;
const removeChannel = vi.fn();
const mockChannel = {
  on: vi.fn(
    (
      _evt: string,
      filter: { table: string },
      cb: (payload: unknown) => void
    ) => {
      changeHandlers[filter.table] = cb;
      return mockChannel;
    }
  ),
  subscribe: vi.fn((cb: typeof statusCb) => {
    statusCb = cb;
    return mockChannel;
  }),
};
const channel = vi.fn(() => mockChannel);

const maybeSingle = vi.fn();
const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle,
};
const from = vi.fn(() => queryBuilder);

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) =>
      (channel as unknown as (...a: unknown[]) => typeof mockChannel)(...args),
    removeChannel: (...args: unknown[]) => removeChannel(...args),
    from: (...args: unknown[]) =>
      (from as unknown as (...a: unknown[]) => typeof queryBuilder)(...args),
  },
}));

import { useApplicationRealtime } from './useApplicationRealtime';

describe('useApplicationRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changeHandlers = {};
    statusCb = null;
    maybeSingle.mockResolvedValue({ data: APP_ROW, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the application on mount', async () => {
    const { result } = renderHook(() => useApplicationRealtime(APP_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).toHaveBeenCalledWith('applications');
    expect(result.current.application).toEqual(APP_ROW);
    expect(result.current.error).toBeNull();
  });

  it('subscribes to row updates AND history inserts for this application', async () => {
    renderHook(() => useApplicationRealtime(APP_ID));

    expect(channel).toHaveBeenCalledWith(`application-${APP_ID}`);
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        table: 'applications',
        event: 'UPDATE',
        filter: `id=eq.${APP_ID}`,
      }),
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        table: 'application_status_history',
        event: 'INSERT',
        filter: `application_id=eq.${APP_ID}`,
      }),
      expect.any(Function)
    );
  });

  it('refetches when a history row is inserted', async () => {
    const { result } = renderHook(() => useApplicationRealtime(APP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = { ...APP_ROW, status: 'under_review' };
    maybeSingle.mockResolvedValue({ data: updated, error: null });

    await act(async () => {
      changeHandlers['application_status_history']?.({});
    });

    await waitFor(() =>
      expect(result.current.application?.status).toBe('under_review')
    );
  });

  it('refetches when the application row updates', async () => {
    const { result } = renderHook(() => useApplicationRealtime(APP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = { ...APP_ROW, status: 'approved' };
    maybeSingle.mockResolvedValue({ data: updated, error: null });

    await act(async () => {
      changeHandlers['applications']?.({});
    });

    await waitFor(() =>
      expect(result.current.application?.status).toBe('approved')
    );
  });

  it('refetches when the window regains focus (degraded mode)', async () => {
    const { result } = renderHook(() => useApplicationRealtime(APP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = { ...APP_ROW, status: 'home_visit' };
    maybeSingle.mockResolvedValue({ data: updated, error: null });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() =>
      expect(result.current.application?.status).toBe('home_visit')
    );
  });

  it('surfaces fetch errors without crashing', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('network down'),
    });

    const { result } = renderHook(() => useApplicationRealtime(APP_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.application).toBeNull();
  });

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useApplicationRealtime(APP_ID));
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('does nothing when applicationId is null', async () => {
    const { result } = renderHook(() => useApplicationRealtime(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(channel).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(result.current.application).toBeNull();
  });

  it('resubscribes after CHANNEL_ERROR with backoff', async () => {
    const { result } = renderHook(() => useApplicationRealtime(APP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(channel).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    act(() => {
      statusCb?.('CHANNEL_ERROR');
    });
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();

    await waitFor(() => expect(channel).toHaveBeenCalledTimes(2));
    expect(removeChannel).toHaveBeenCalled();
  });
});
