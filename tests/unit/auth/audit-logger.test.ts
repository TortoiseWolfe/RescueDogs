/**
 * Unit tests for lib/auth/audit-logger (form call sites → RPC #304)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockLoggerFns = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLoggerFns),
}));

const { logAuthEvent, getUserAuditLogs } = await import(
  '@/lib/auth/audit-logger'
);

describe('logAuthEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'uuid', error: null });
  });

  it('calls log_auth_audit_event with the event payload', async () => {
    await logAuthEvent({
      user_id: '00000000-0000-0000-0000-000000000001',
      event_type: 'sign_in',
      event_data: { provider: 'email' },
      success: true,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'log_auth_audit_event',
      expect.objectContaining({
        p_event_type: 'sign_in',
        p_user_id: '00000000-0000-0000-0000-000000000001',
        p_event_data: { provider: 'email' },
        p_success: true,
      })
    );
  });

  it('strips credential-ish keys from event_data', async () => {
    await logAuthEvent({
      event_type: 'sign_in',
      success: false,
      event_data: {
        email: 'a@b.com',
        password: 'secret',
        reason: 'bad_password',
      },
    });

    expect(mockRpc.mock.calls[0][1].p_event_data).toEqual({
      email: 'a@b.com',
      reason: 'bad_password',
    });
  });

  it('does not throw when the RPC returns an error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'boom', code: 'XX000' },
    });

    await expect(
      logAuthEvent({ event_type: 'sign_out' })
    ).resolves.toBeUndefined();
    expect(mockLoggerFns.error).toHaveBeenCalled();
  });
});

describe('getUserAuditLogs', () => {
  it('returns rows from auth_audit_logs', async () => {
    const rows = [
      {
        user_id: 'u1',
        event_type: 'sign_in',
        success: true,
      },
    ];
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    mockFrom.mockReturnValue({ select });

    const result = await getUserAuditLogs('u1', 10);

    expect(mockFrom).toHaveBeenCalledWith('auth_audit_logs');
    expect(result).toEqual(rows);
  });
});
