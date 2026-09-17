/**
 * Audit Logger
 * Logs authentication and security events to the audit trail
 * REQ-SEC-007: Audit logging for security events
 *
 * Writes go through `log_auth_audit_event` (#304) — a SECURITY DEFINER RPC —
 * because RLS denies direct browser INSERTs on `auth_audit_logs` (42501).
 * IP/UA are derived from PostgREST request headers inside the function.
 */

import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('lib:auth:audit-logger');

export type AuditEventType =
  | 'sign_in'
  | 'sign_out'
  | 'sign_up'
  | 'password_change'
  | 'password_reset_request'
  | 'email_verification'
  | 'oauth_link'
  | 'oauth_unlink'
  | 'payment_retry';

export interface AuditLogEntry {
  user_id?: string;
  event_type: AuditEventType;
  event_data?: Record<string, unknown>;
  /** Ignored on write — IP comes from PostgREST headers in the RPC (#304). */
  ip_address?: string;
  user_agent?: string;
  success?: boolean;
  error_message?: string;
}

/**
 * Strip credential-ish keys before they leave the browser.
 * The RPC also filters; this is defense in depth.
 */
function stripCredentials(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return data;
  const stripped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (/password|token|secret|key|credential/i.test(k)) continue;
    stripped[k] = v;
  }
  return stripped;
}

/**
 * Log an authentication or security event to the audit trail
 *
 * @param entry - Audit log entry details
 *
 * @example
 * // Log successful sign-in
 * await logAuthEvent({
 *   user_id: user.id,
 *   event_type: 'sign_in',
 *   event_data: { provider: 'email' }
 * });
 *
 * @example
 * // Log failed password change
 * await logAuthEvent({
 *   user_id: user.id,
 *   event_type: 'password_change',
 *   success: false,
 *   error_message: 'Current password incorrect'
 * });
 */
export async function logAuthEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const userAgent =
      entry.user_agent ||
      (typeof navigator !== 'undefined' ? navigator.userAgent : undefined);

    const { error } = await supabase.rpc('log_auth_audit_event', {
      p_event_type: entry.event_type,
      p_user_id: entry.user_id || null,
      p_event_data: (stripCredentials(entry.event_data) as Json) || null,
      p_success: entry.success !== undefined ? entry.success : true,
      p_error_message: entry.error_message || null,
      p_user_agent: userAgent || null,
    });

    if (error) {
      logger.error('Failed to log audit event', {
        error,
        eventType: entry.event_type,
      });
      // Non-critical failure - don't throw
    }
  } catch (error) {
    logger.error('Error logging audit event', {
      error,
      eventType: entry.event_type,
    });
    // Non-critical failure - don't throw
  }
}

/**
 * Get user audit logs (for displaying to the user)
 *
 * @param userId - User ID to fetch logs for
 * @param limit - Maximum number of logs to return
 * @returns Array of audit log entries
 */
export async function getUserAuditLogs(
  userId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('auth_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch audit logs', { error, userId });
      return [];
    }

    return (data || []) as AuditLogEntry[];
  } catch (error) {
    logger.error('Error fetching audit logs', { error, userId });
    return [];
  }
}
