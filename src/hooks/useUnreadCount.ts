import { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createMessagingClient } from '@/lib/supabase/messaging-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const logger = createLogger('hooks:unreadCount');

export function useUnreadCount() {
  const { user } = useAuth();
  // Depend on the id, not the user object: AuthContext replaces `user` on every
  // auth event (including hourly TOKEN_REFRESHED), which used to tear down and
  // recreate the channel each time.
  const userId = user?.id ?? null;

  const [unreadCount, setUnreadCount] = useState(0);
  // Comma-joined conversation ids, used to build the server-side Realtime
  // filter. A primitive, so a refetch that returns the same set does not
  // resubscribe.
  const [conversationKey, setConversationKey] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setConversationKey('');
      return;
    }

    try {
      const msgClient = createMessagingClient(supabase);

      // Get all conversations for this user
      const result = await msgClient
        .from('conversations')
        .select('id')
        .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);

      const conversations = result.data as { id: string }[] | null;

      if (!conversations || conversations.length === 0) {
        setUnreadCount(0);
        setConversationKey('');
        return;
      }

      const conversationIds = conversations.map((c) => c.id);
      setConversationKey(conversationIds.join(','));

      // Count unread messages (messages where read_at is null and sender is NOT current user)
      const { count } = await msgClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .is('read_at', null);

      setUnreadCount(count || 0);
    } catch (error) {
      logger.error('Failed to fetch unread count', { error });
      setUnreadCount(0);
    }
  }, [userId]);

  // Stable handle so the subscription effect below does not depend on the
  // callback's identity.
  const fetchRef = useRef(fetchUnreadCount);
  useEffect(() => {
    fetchRef.current = fetchUnreadCount;
  }, [fetchUnreadCount]);

  // Initial fetch, plus a refetch when the tab regains focus (covers gaps if
  // realtime dropped while backgrounded).
  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setConversationKey('');
      return;
    }

    void fetchUnreadCount();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, fetchUnreadCount]);

  // Realtime, scoped SERVER-SIDE to this user's conversations (#224).
  //
  // This binding used to be table-wide (`table: 'messages'` with no filter) and
  // the conversation check ran in JS after delivery — so every message in the
  // table was billed and delivered to every signed-in user on every page, then
  // discarded. GlobalNav renders in the root layout, so the fan-out was
  // (all message row changes) x (all signed-in tabs). The filter moves exactly
  // that predicate to the server.
  useEffect(() => {
    if (!userId || !conversationKey) {
      return;
    }

    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=in.(${conversationKey})`,
        },
        () => {
          void fetchRef.current();
        }
      )
      .subscribe((status) => {
        // Loudly, because nothing in the E2E suite covers the unread badge: if
        // the filter is ever rejected the badge would otherwise go quietly dead.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Unread-count realtime channel failed to join', {
            status,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, conversationKey]);

  return unreadCount;
}
