/**
 * Unit tests for PaymentQueueAdapter idempotent INSERT path.
 *
 * Validates the offline-queue retry safety contract from #52:
 * - A queued idempotency_key flows into the insert payload.
 * - A unique-violation (23505) on that key is treated as conflicted (the
 *   prior attempt's row is already there); the queue row still completes.
 * - Any other insert error fails the queue row.
 *
 * The write is a plain insert, not upsert(onConflict: 'idempotency_key'):
 * the unique index on that column is partial, which a bare ON CONFLICT
 * column list cannot infer (#477).
 *
 * @module lib/offline-queue/__tests__/payment-adapter.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Per-call insert mock so each test can specify the response shape.
//   await supabase.from('payment_intents').insert(payload)
const mockInsert = vi.fn();
// Post-23505 lookup: the row a duplicate key collided with (RLS: own rows only).
const mockExisting = vi.fn();
const mockFrom = vi.fn();

// Reconfigure the chain in beforeEach so each test starts from a known
// state. mockReturnValue calls happen there.

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'test-user-1' } },
        error: null,
      })),
    },
  },
}));

// Import AFTER the mock so the adapter binds to our mocked supabase.
import { PaymentQueueAdapter } from '../payment-adapter';

describe('PaymentQueueAdapter (idempotent INSERT path, #52)', () => {
  let adapter: PaymentQueueAdapter;

  beforeEach(async () => {
    mockInsert.mockReset();
    mockExisting
      .mockReset()
      .mockResolvedValue({ data: { id: 'x' }, error: null });
    mockFrom.mockReset().mockReturnValue({
      insert: mockInsert,
      select: () => ({
        eq: () => ({ maybeSingle: mockExisting }),
      }),
    });

    adapter = new PaymentQueueAdapter();
    await adapter.clear();
  });

  it('flows the queued idempotency_key into the insert', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'fixed-key-1',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(1);
    expect(result.conflicted).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith('payment_intents');

    const [payload] = mockInsert.mock.calls[0];
    expect(payload.idempotency_key).toBe('fixed-key-1');
    expect(payload.amount).toBe(1000);
    expect(payload.template_user_id).toBe('test-user-1');
  });

  it('treats a unique-violation (23505) as conflicted (work was already done)', async () => {
    // Server already had this key → Postgres rejects the insert with 23505.
    mockInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value' },
    });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'already-inserted-key',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(0);
    expect(result.conflicted).toBe(1);
    expect(result.failed).toBe(0);

    // The queue row is marked completed even though the dedupe path
    // fired — the user's work is done from their perspective.
    const all = await adapter.getQueue();
    expect(all[0].status).toBe('completed');
  });

  it('fails the row when the duplicate key is not visible to this user', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value' },
    });
    mockExisting.mockResolvedValueOnce({ data: null, error: null });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'squatted-key',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.conflicted).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('fails the queue row on any other insert error', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { code: '42501', message: 'permission denied' },
    });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'denied-key',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(0);
    expect(result.conflicted).toBe(0);
    expect(result.failed).toBe(1);
  });
});
