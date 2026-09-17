/**
 * Unit Test: AuditLogger
 *
 * Tests the authentication audit logger with a mocked Supabase client and a
 * mocked logger. No network dependency - fast, reliable unit tests.
 *
 * Key behaviors verified:
 *  - each public logger method calls log_auth_audit_event with the correct
 *    event_type (and user_id / event_data shape) (#304)
 *  - stripCredentials() removes any event_data field whose name matches
 *    /password|token|secret|key|credential/i before the RPC
 *  - extractRequestInfo() still pulls user_agent from a Request-like object
 *    (IP is derived server-side from PostgREST headers; not sent as p_ip)
 *  - log() SILENTLY swallows RPC errors / exceptions (never throws) and
 *    routes them to logger.error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthEventType as AuthEventTypeT } from '../audit-logger';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const mockLoggerFns = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLoggerFns),
}));

const mockRpc = vi.fn();

const mockSupabase = {
  rpc: mockRpc,
} as unknown as SupabaseClient;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

const { AuditLogger, AuthEventType } = await import('../audit-logger');

const makeRequest = (headers: Record<string, string>) => {
  const get = vi.fn((name: string) => headers[name.toLowerCase()] ?? null);
  return { headers: { get } } as unknown as Request;
};

const lastRpcArgs = () =>
  mockRpc.mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe('AuditLogger', () => {
  let auditLogger: InstanceType<typeof AuditLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'uuid', error: null });
    auditLogger = new AuditLogger();
  });

  describe('logSignUp', () => {
    it('calls log_auth_audit_event with a sign_up payload', async () => {
      await auditLogger.logSignUp(USER_ID, 'user@example.com');

      expect(mockRpc).toHaveBeenCalledWith(
        'log_auth_audit_event',
        expect.objectContaining({
          p_user_id: USER_ID,
          p_event_type: AuthEventType.SIGN_UP,
          p_event_data: { email: 'user@example.com' },
        })
      );
    });

    it('forwards user-agent from the request (IP stays server-side)', async () => {
      const request = makeRequest({
        'x-forwarded-for': '203.0.113.5',
        'user-agent': 'TestAgent/1.0',
      });

      await auditLogger.logSignUp(USER_ID, 'user@example.com', request);

      expect(lastRpcArgs()).toMatchObject({
        p_user_agent: 'TestAgent/1.0',
      });
      expect(lastRpcArgs()).not.toHaveProperty('p_ip_address');
    });
  });

  describe('logSignIn', () => {
    it('records sign_in_success when success is true', async () => {
      await auditLogger.logSignIn(USER_ID, 'user@example.com', true);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.SIGN_IN_SUCCESS,
        p_event_data: { email: 'user@example.com' },
        p_success: true,
      });
    });

    it('records sign_in_failed with null user_id and p_success false', async () => {
      await auditLogger.logSignIn(null, 'user@example.com', false);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: null,
        p_event_type: AuthEventType.SIGN_IN_FAILED,
        p_event_data: { email: 'user@example.com' },
        p_success: false,
      });
    });
  });

  describe('logSignOut', () => {
    it('calls the RPC with a sign_out event', async () => {
      await auditLogger.logSignOut(USER_ID);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.SIGN_OUT,
      });
    });

    it('omits user-agent when no request is given', async () => {
      await auditLogger.logSignOut(USER_ID);

      expect(lastRpcArgs().p_user_agent).toBeNull();
    });
  });

  describe('logPasswordChange', () => {
    it('calls the RPC with a password_change event', async () => {
      await auditLogger.logPasswordChange(USER_ID);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.PASSWORD_CHANGE,
      });
    });
  });

  describe('logPasswordResetRequest', () => {
    it('calls the RPC with a null user_id', async () => {
      await auditLogger.logPasswordResetRequest('user@example.com');

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: null,
        p_event_type: AuthEventType.PASSWORD_RESET_REQUEST,
        p_event_data: { email: 'user@example.com' },
      });
    });

    it('forwards user-agent from the request', async () => {
      const request = makeRequest({
        'x-real-ip': '198.51.100.7',
        'user-agent': 'ResetAgent/2.0',
      });

      await auditLogger.logPasswordResetRequest('user@example.com', request);

      expect(lastRpcArgs()).toMatchObject({
        p_user_agent: 'ResetAgent/2.0',
      });
    });
  });

  describe('logPasswordResetComplete', () => {
    it('calls the RPC with password_reset_complete', async () => {
      await auditLogger.logPasswordResetComplete(USER_ID);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.PASSWORD_RESET_COMPLETE,
      });
    });
  });

  describe('logEmailVerificationSent', () => {
    it('includes the email in event_data', async () => {
      await auditLogger.logEmailVerificationSent(USER_ID, 'user@example.com');

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.EMAIL_VERIFICATION_SENT,
        p_event_data: { email: 'user@example.com' },
      });
    });
  });

  describe('logEmailVerificationComplete', () => {
    it('calls the RPC with email_verification_complete', async () => {
      await auditLogger.logEmailVerificationComplete(USER_ID);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.EMAIL_VERIFICATION_COMPLETE,
      });
    });
  });

  describe('logTokenRefresh', () => {
    it('calls the RPC with token_refresh', async () => {
      await auditLogger.logTokenRefresh(USER_ID);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.TOKEN_REFRESH,
      });
    });
  });

  describe('logAccountDelete', () => {
    it('calls the RPC with account_delete', async () => {
      await auditLogger.logAccountDelete(USER_ID);

      expect(lastRpcArgs()).toMatchObject({
        p_user_id: USER_ID,
        p_event_type: AuthEventType.ACCOUNT_DELETE,
      });
    });
  });

  describe('stripCredentials', () => {
    it('strips password/token/secret/key/credential fields from event_data', async () => {
      class TestableAuditLogger extends AuditLogger {
        async logRaw(entry: {
          user_id: string | null;
          event_type: AuthEventTypeT;
          event_data?: Record<string, unknown>;
        }) {
          // @ts-expect-error - exercising the private log() method under test
          await this.log(entry);
        }
      }

      const testable = new TestableAuditLogger();
      await testable.logRaw({
        user_id: USER_ID,
        event_type: AuthEventType.SIGN_IN_SUCCESS,
        event_data: {
          email: 'user@example.com',
          password: 'hunter2',
          access_token: 'abc.def',
          apiKey: 'sk-123',
          mySecret: 'shh',
          userCredential: 'nope',
          safeField: 'kept',
        },
      });

      expect(lastRpcArgs().p_event_data).toEqual({
        email: 'user@example.com',
        safeField: 'kept',
      });
    });

    it('sends null event_data when none was provided', async () => {
      await auditLogger.logSignOut(USER_ID);
      expect(lastRpcArgs().p_event_data).toBeNull();
    });
  });

  describe('error handling (log never throws)', () => {
    it('swallows a Supabase RPC error and routes it to logger.error', async () => {
      mockRpc.mockResolvedValue({ error: { message: 'rpc boom' } });

      await expect(auditLogger.logSignOut(USER_ID)).resolves.toBeUndefined();

      expect(mockLoggerFns.error).toHaveBeenCalledWith('Audit log failed', {
        error: 'rpc boom',
      });
    });

    it('swallows a thrown RPC exception and routes it to logger.error', async () => {
      const boom = new Error('network down');
      mockRpc.mockRejectedValue(boom);

      await expect(auditLogger.logSignOut(USER_ID)).resolves.toBeUndefined();

      expect(mockLoggerFns.error).toHaveBeenCalledWith('Audit log exception', {
        error: boom,
      });
    });
  });
});
