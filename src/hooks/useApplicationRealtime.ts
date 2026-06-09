/**
 * useApplicationRealtime Hook
 * Live data for the application status tracker: initial fetch + Supabase
 * Realtime subscription + degraded-mode fallbacks.
 *
 * Constitution Principle I (No One Gets Ghosted): the tracker must update
 * the moment the shelter changes status. Resilient gate: when Realtime
 * can't be trusted (channel error, tab slept), we refetch rather than
 * show a stale status as current.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import { ApplicationService } from '@/services/applications';
import type { ApplicationWithPetAndHistory } from '@/types/applications';

const logger = createLogger('hooks:applicationRealtime');

/** Base backoff for resubscribe attempts after channel errors. */
const RESUBSCRIBE_BASE_DELAY_MS = 2000;
const RESUBSCRIBE_MAX_DELAY_MS = 30000;

export interface UseApplicationRealtimeReturn {
  application: ApplicationWithPetAndHistory | null;
  loading: boolean;
  error: Error | null;
  /** Manual refetch (also used internally by the fallbacks). */
  refetch: () => Promise<void>;
}

/**
 * Subscribe to one application's row + status history.
 *
 * On any realtime event we REFETCH the joined shape instead of patching
 * from the payload — one code path, and the row UPDATE + history INSERT
 * arrive in the same transaction so a refetch is always consistent.
 *
 * Fallbacks beyond the usePaymentRealtime pattern:
 * - refetch on window focus / visibilitychange (PWA tab sleep)
 * - resubscribe with capped exponential backoff on CHANNEL_ERROR/TIMED_OUT
 */
export function useApplicationRealtime(
  applicationId: string | null
): UseApplicationRealtimeReturn {
  const [application, setApplication] =
    useState<ApplicationWithPetAndHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Bump to tear down + recreate the channel (resubscribe path)
  const [subscribeEpoch, setSubscribeEpoch] = useState(0);
  const retryCountRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!applicationId) return;
    try {
      const service = new ApplicationService(supabase);
      const data = await service.getApplication(applicationId);
      setApplication(data);
      setError(null);
    } catch (err) {
      logger.error('Failed to fetch application', { err });
      setError(
        err instanceof Error ? err : new Error('Failed to fetch application')
      );
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const guardedRefetch = async () => {
      if (isMounted) await refetch();
    };

    guardedRefetch();

    const channel = supabase
      .channel(`application-${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `id=eq.${applicationId}`,
        },
        () => {
          logger.debug('Application row updated; refetching');
          guardedRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'application_status_history',
          filter: `application_id=eq.${applicationId}`,
        },
        () => {
          logger.debug('Status history appended; refetching');
          guardedRefetch();
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
          // Catch anything missed while the channel was down
          guardedRefetch();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const delay = Math.min(
            RESUBSCRIBE_BASE_DELAY_MS * 2 ** retryCountRef.current,
            RESUBSCRIBE_MAX_DELAY_MS
          );
          retryCountRef.current += 1;
          logger.warn('Realtime channel degraded; resubscribing', {
            status,
            delay,
          });
          retryTimer = setTimeout(() => {
            if (isMounted) setSubscribeEpoch((epoch) => epoch + 1);
          }, delay);
        }
      });

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      supabase.removeChannel(channel);
    };
  }, [applicationId, refetch, subscribeEpoch]);

  // Degraded-mode fallback: refetch when the tab comes back to life
  useEffect(() => {
    if (!applicationId) return;

    const onFocus = () => refetch();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [applicationId, refetch]);

  return { application, loading, error, refetch };
}
