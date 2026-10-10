/**
 * Addresses that must never be sent real email (#433).
 *
 * Sending to them either fails outright (reserved domains hard-bounce) or
 * spends Resend quota on CI. Hard bounces from noreply@raisedpaws.com lower
 * the domain's sender reputation, which pushes real rescue notifications
 * toward spam.
 *
 * No imports, so Vitest can load this file directly alongside Deno.
 */

/** RFC 2606 / RFC 6761 reserved TLDs, plus the project's `.demo` seed convention. */
const RESERVED_TLDS = ['test', 'example', 'invalid', 'localhost', 'demo'];

/** RFC 2606 reserved second-level domains. */
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

/** Local-part tags the test suites add to otherwise real inboxes. */
const TEST_TAGS = ['+e2e', '+playwright', '+ci-'];

export function isTestRecipient(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return true;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const tld = domain.slice(domain.lastIndexOf('.') + 1);

  return (
    RESERVED_TLDS.includes(tld) ||
    RESERVED_DOMAINS.some(
      (reserved) => domain === reserved || domain.endsWith(`.${reserved}`)
    ) ||
    TEST_TAGS.some((tag) => local.includes(tag))
  );
}
