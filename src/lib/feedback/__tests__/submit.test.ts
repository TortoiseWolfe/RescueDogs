import { describe, it, expect, vi, beforeEach } from 'vitest';

// `vi.hoisted` because `vi.mock` factories are lifted above every other statement in the
// file -- a plain `const` referenced from one is read before it is initialised.
const { insert, upload, getUser, downscale } = vi.hoisted(() => ({
  insert: vi.fn(),
  upload: vi.fn(),
  getUser: vi.fn(),
  downscale: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser },
    storage: { from: () => ({ upload }) },
    from: () => ({ insert }),
  }),
}));

vi.mock('@/lib/pet-photos/upload', () => ({
  downscalePetPhoto: downscale,
}));

import { sendFeedback } from '../submit';

const UID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: UID } } });
  insert.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ error: null });
  downscale.mockResolvedValue({ data: new Blob(['x']), type: 'image/jpeg' });
});

describe('sendFeedback', () => {
  it('writes the row for a signed-in reporter', async () => {
    const result = await sendFeedback({
      body: 'The back button lost my form.',
    });
    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: UID,
        body: 'The back button lost my form.',
      })
    );
  });

  /**
   * THE ONE THAT MATTERS MOST. The sentence IS the report; the picture is only evidence for
   * it. Somebody who typed out what went wrong and got an error because their screenshot
   * was too large does not type it again -- so a failed upload must cost the picture and
   * nothing else. Mutation-checked: removing the try/catch turns this red.
   */
  it('still sends the words when the picture fails to upload', async () => {
    downscale.mockRejectedValue(new Error('canvas is not available'));
    const result = await sendFeedback({
      body: 'Photos never appear.',
      screenshot: new File(['x'], 'shot.png', { type: 'image/png' }),
    });
    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Photos never appear.',
        screenshot_path: null,
      })
    );
  });

  it('sends the words when storage itself refuses, too', async () => {
    upload.mockResolvedValue({ error: { message: 'Payload too large' } });
    const result = await sendFeedback({
      body: 'Still broken.',
      screenshot: new File(['x'], 'shot.jpg', { type: 'image/jpeg' }),
    });
    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ screenshot_path: null })
    );
  });

  /**
   * BYTES FIRST, ROW SECOND. A row naming an object that was never written points at
   * nothing; an object with no row is litter a sweep ignores. Asserting the ORDER rather
   * than just the outcome is what keeps a future refactor from swapping them.
   */
  it('writes the bytes before the row, and under the reporter’s own prefix', async () => {
    const order: string[] = [];
    upload.mockImplementation(async () => {
      order.push('upload');
      return { error: null };
    });
    insert.mockImplementation(async () => {
      order.push('insert');
      return { error: null };
    });

    await sendFeedback({
      body: 'With a picture.',
      screenshot: new File(['x'], 'shot.jpg', { type: 'image/jpeg' }),
    });

    expect(order).toEqual(['upload', 'insert']);
    const [path] = upload.mock.calls[0];
    // The prefix the CHECK constraint and the trigger both police. A path under anybody
    // else's id is refused by the database; this is what stops us sending one.
    expect(path).toMatch(new RegExp(`^${UID}/[0-9a-f-]{36}\\.jpg$`));
  });

  /**
   * The rate limit gets its own sentence. "Something went wrong" over a cap reads as a bug
   * in the bug reporter, which is the least useful message this screen could give.
   */
  it('says what a rate limit actually is, rather than reporting a failure', async () => {
    insert.mockResolvedValue({
      error: { code: '54023', message: 'feedback_too_often' },
    });
    const result = await sendFeedback({ body: 'Seventh in an hour.' });
    expect(result).toMatchObject({ ok: false, reason: 'too_often' });
    expect((result as { message: string }).message).not.toMatch(
      /went wrong|error/i
    );
  });

  /**
   * Signed-out is a REAL STATE with a real answer, not a failure. This repo cannot take
   * anonymous auth -- it would satisfy 39 `TO authenticated` policies including one that
   * reads every user profile -- so the honest response names the route that does work.
   */
  it('sends a signed-out visitor to the contact form instead of failing silently', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await sendFeedback({ body: 'From nobody.' });
    expect(result).toMatchObject({ ok: false, reason: 'not_signed_in' });
    expect((result as { message: string }).message).toMatch(/contact/i);
    expect(insert).not.toHaveBeenCalled();
  });
});
