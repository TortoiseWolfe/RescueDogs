/**
 * Unit Tests for useUnreadCount
 *
 * Ported from SpokeToWork fork — verifies Realtime subscription
 * replaces 30s polling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock user
const mockUser = { id: 'user-123' };

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    session: { user: mockUser },
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  })),
}));

// Mock channel
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

// Mock messaging client
const mockMessagingFrom = vi.fn();
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: vi.fn(() => ({
    from: mockMessagingFrom,
  })),
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

// Import after mocks
import { useUnreadCount } from '../useUnreadCount';

describe('useUnreadCount', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Restore the signed-in default. vi.clearAllMocks() clears CALLS but not
    // return values, so the "no user" test below used to leak `user: null` into
    // every test after it — which is why several of them passed while the hook
    // was returning early and never touching Supabase at all.
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: { user: mockUser },
      isLoading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    } as never);

    // Setup messaging client mock chain
    mockMessagingFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: vi.fn(() => ({
            or: vi.fn().mockResolvedValue({
              data: [{ id: 'conv-1' }, { id: 'conv-2' }],
            }),
          })),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              neq: vi.fn(() => ({
                is: vi.fn().mockResolvedValue({ count: 5 }),
              })),
            })),
          })),
        };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with 0 unread count', () => {
      const { result } = renderHook(() => useUnreadCount());

      expect(result.current).toBe(0);
    });
  });

  describe('when user is authenticated', () => {
    it('should fetch unread count', async () => {
      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(5);
      });
    });

    it('should setup realtime subscription', async () => {
      const { supabase } = await import('@/lib/supabase/client');

      renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith(
          `unread-messages-${mockUser.id}`
        );
      });
    });

    it('should subscribe to postgres_changes on messages', async () => {
      renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            event: '*',
            schema: 'public',
            table: 'messages',
          }),
          expect.any(Function)
        );
      });
    });

    // #224: the binding must be scoped SERVER-SIDE. It was previously
    // table-wide, so every message in the table was delivered to every
    // signed-in user on every page and then discarded in JS. Asserting the
    // exact filter string, not objectContaining, so a regression to the
    // unfiltered form fails here — nothing in the E2E suite covers the badge.
    it('should scope the subscription to the user conversations (#224)', async () => {
      renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: 'conversation_id=in.(conv-1,conv-2)',
          },
          expect.any(Function)
        );
      });
    });

    it('should not open a table-wide messages binding (#224)', async () => {
      renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalled();
      });

      const bindings = mockChannel.on.mock.calls.filter(
        (call) => call[0] === 'postgres_changes'
      );
      expect(bindings.length).toBeGreaterThan(0);
      for (const [, config] of bindings) {
        expect(config).toHaveProperty('filter');
        expect((config as { filter: string }).filter).toContain(
          'conversation_id=in.'
        );
      }
    });
  });

  describe('when user is not authenticated', () => {
    it('should return 0 when no user', async () => {
      const { useAuth } = await import('@/contexts/AuthContext');
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
      } as never);

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(0);
      });
    });
  });

  describe('when no conversations', () => {
    it('should return 0 when no conversations', async () => {
      mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              or: vi.fn().mockResolvedValue({ data: [] }),
            })),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(0);
      });
    });
  });

  describe('when no conversations', () => {
    it('should not subscribe at all (#224)', async () => {
      const { supabase } = await import('@/lib/supabase/client');

      mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              or: vi.fn().mockResolvedValue({ data: [] }),
            })),
          };
        }
        return {};
      });

      renderHook(() => useUnreadCount());

      // Wait for the conversations lookup to actually resolve. Asserting on
      // `result.current === 0` would be useless here: the hook STARTS at 0, so
      // waitFor resolves on the first render and the assertion below would race
      // the effect instead of testing it.
      await waitFor(() => {
        expect(mockMessagingFrom).toHaveBeenCalledWith('conversations');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // No conversations means nothing to watch — opening a channel here is
      // pure cost.
      expect(supabase.channel).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 0 on error', async () => {
      mockMessagingFrom.mockImplementation(() => {
        throw new Error('Database error');
      });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => {
        expect(result.current).toBe(0);
      });
    });
  });

  describe('cleanup', () => {
    it('should handle unmount without throwing', () => {
      const { unmount } = renderHook(() => useUnreadCount());

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('return value', () => {
    it('should return a number', () => {
      const { result } = renderHook(() => useUnreadCount());

      expect(typeof result.current).toBe('number');
    });
  });
});
