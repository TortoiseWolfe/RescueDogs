/**
 * Send a bug report: optional bytes first, the row second.
 *
 * WHY THIS IS NOT `/contact`. That form is for a person writing to the RESCUE -- it reaches
 * a human inbox through the `contact-message` Edge Function, and it asks for a name and an
 * email because somebody is going to write back. This is a person telling US the software is
 * broken: no name, no address, no reply path, and it becomes a tracked issue within the hour
 * without anybody reading a mailbox.
 *
 * BYTES FIRST, ROW SECOND -- and this is the OPPOSITE of the ordering a deletion uses, for
 * the same underlying reason. Whichever can strand the other goes second. A row naming an
 * object that failed to upload points at nothing; an object with no row is litter a sweep
 * ignores.
 *
 * AND A FAILED UPLOAD MUST NOT LOSE THE WORDS. The sentence IS the report; the picture is
 * evidence for it. So the upload is wrapped and swallowed, and the row goes in either way.
 * Somebody who typed out what went wrong and got an error because their screenshot was too
 * big does not type it again.
 *
 * @module lib/feedback/submit
 */

import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';
import { downscalePetPhoto } from '@/lib/pet-photos/upload';
import { deviceFacts } from './device-facts';

const BUCKET = 'feedback';

export type FeedbackResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_signed_in' | 'too_often' | 'failed';
      message: string;
    };

/**
 * The six-an-hour cap raises this errcode from `feedback_guard()`. It gets its own sentence
 * because "something went wrong" over a rate limit reads as a bug in the bug reporter.
 */
const TOO_OFTEN = '54023';

export interface SendFeedbackInput {
  body: string;
  /** Chosen from the library by the reporter. Never a silent capture -- see FeedbackSheet. */
  screenshot?: File | null;
  /** The route they were on, from `usePathname()`. */
  route?: string;
}

export async function sendFeedback({
  body,
  screenshot,
  route,
}: SendFeedbackInput): Promise<FeedbackResult> {
  const supabase = createClient();

  /**
   * SIGNED IN ONLY, AND THAT IS A PORT DECISION RATHER THAN A DEFAULT. Upstream this accepts
   * anonymous identities so the person who cannot get in can still report. This repo has
   * `enable_anonymous_sign_ins = false`, and an anonymous Supabase user IS the
   * `authenticated` Postgres role -- turning it on would satisfy all 39 `TO authenticated`
   * policies in the migration, including one that reads every user profile. A signed-out
   * visitor is sent to /contact instead, which already works.
   */
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) {
    return {
      ok: false,
      reason: 'not_signed_in',
      message: 'Sign in first, or use the contact form.',
    };
  }

  let screenshotPath: string | undefined;
  if (screenshot) {
    try {
      // `downscalePetPhoto` rather than a second shrinker: one implementation of "make this
      // image small enough to send" is all this repo should have, and that one is already
      // tested and already tuned for phone camera JPEGs.
      const { data: bytes, type } = await downscalePetPhoto(screenshot);
      // The path shape the CHECK constraint and the trigger both police:
      // `{auth_user_id}/{uuid}.{ext}`. The prefix must be the caller's own id.
      const ext =
        type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: type });
      if (!error) screenshotPath = path;
    } catch {
      // Swallowed on purpose. See the docblock: the words survive a failed picture.
    }
  }

  const { error } = await supabase.from('feedback').insert({
    auth_user_id: uid,
    body: body.trim().slice(0, 2000),
    // `DeviceFacts` is a flat string map, which satisfies `Json` structurally; the cast
    // is for the generated union, not a widening of what travels.
    context: deviceFacts(route) as unknown as Json,
    screenshot_path: screenshotPath ?? null,
  });

  if (error) {
    if (error.code === TOO_OFTEN) {
      return {
        ok: false,
        reason: 'too_often',
        message:
          'That is a few reports in a short time. Try again in a little while.',
      };
    }
    return {
      ok: false,
      reason: 'failed',
      message: 'That did not send. Please try again.',
    };
  }

  return { ok: true };
}
