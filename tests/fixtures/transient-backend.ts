/**
 * Retry helpers for brief gateway failures from the hosted Supabase project.
 *
 * A full E2E run starts 24 shards within seconds of each other and every one
 * of them calls the admin API in global setup. The gateway sometimes answers
 * such a burst with an HTML error page (which the client reports as
 * "Unexpected token '<', "<!DOCTYPE "... is not valid JSON") or with an
 * error whose message is an empty object ("{}"). Both are seconds-long
 * hiccups, not a wrong key or a stopped project, so setup retries them
 * instead of failing the whole shard. A wrong key, a missing user or a
 * stopped project still fails on the first attempt.
 *
 * Pure Node: no Playwright import, so Vitest can load it.
 *
 * @module tests/fixtures/transient-backend
 */

const TRANSIENT_PATTERNS = [
  /unexpected token '?</i, // HTML error page parsed as JSON
  /<!doctype/i,
  /^\s*\{\s*\}?\s*$/, // "{}" or "{" : an error object with no message
  /fetch failed/i,
  /failed to fetch/i,
  /econnreset|etimedout|econnrefused|enotfound|eai_again/i,
  /socket hang up|network error|timed? ?out/i,
  /\b(502|503|504|520|521|522|523|524)\b/,
  /bad gateway|service unavailable|gateway time-?out/i,
  /retryable/i,
  /empty error message/i, // see describeBackendError
];

/**
 * True for an error message that describes a short-lived backend or network
 * hiccup. An empty message counts: the client drops the message on these.
 */
export function isTransientBackendError(message: string | undefined): boolean {
  if (message === undefined || message === null) return true;
  const text = String(message);
  if (text.trim() === '') return true;
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Turn a client error into a message that says something even when the
 * client had nothing to say (an empty or "{}" message), so a log line and
 * isTransientBackendError both have the error's name and status to go on.
 */
export function describeBackendError(error: {
  message?: string;
  name?: string;
  status?: number;
}): string {
  const message = (error.message ?? '').trim();
  if (message !== '' && !/^\{\s*\}?$/.test(message)) return message;
  return `empty error message (${error.name ?? 'unknown error'}, status ${error.status ?? 'none'})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait before retry number `attempt` (1 = first retry): 2 s, 4 s, 8 s, 16 s
 * plus up to 1 s of jitter so parallel shards do not retry in step.
 */
export function transientBackoffMs(attempt: number): number {
  return 2000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 1000);
}

/**
 * Run `operation` until it succeeds or fails for a reason that is not
 * transient. `operation` reports failure by returning an error message
 * (undefined means success), so callers keep the client's own error shape.
 *
 * @returns the last error message, or undefined once an attempt succeeds
 */
export async function retryWhileTransient(
  operation: () => Promise<string | undefined>,
  options: {
    attempts?: number;
    backoffMs?: (attempt: number) => number;
    onRetry?: (attempt: number, message: string) => void;
  } = {}
): Promise<string | undefined> {
  const attempts = options.attempts ?? 5;
  const backoff = options.backoffMs ?? transientBackoffMs;
  let message: string | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      options.onRetry?.(attempt, message ?? '');
      await sleep(backoff(attempt));
    }
    try {
      message = await operation();
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    if (message === undefined) return undefined;
    if (!isTransientBackendError(message)) return message;
  }
  return message;
}
