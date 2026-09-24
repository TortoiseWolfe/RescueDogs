/**
 * Optional pet video link (#326) — https only, link-out (no embed/upload).
 */

const MAX_VIDEO_URL_LENGTH = 2048;

/**
 * Normalize and validate a staff-entered video URL.
 * Empty / whitespace → null. Non-https or invalid → throws with a short message.
 */
export function normalizePetVideoUrl(
  raw: string | null | undefined
): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length > MAX_VIDEO_URL_LENGTH) {
    throw new Error('Video link is too long.');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid video link (https://…).');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Video link must start with https://');
  }
  return url.toString();
}
