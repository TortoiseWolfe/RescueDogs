#!/usr/bin/env node
/**
 * Assert that the LIVE contact channel can actually deliver a message.
 *
 * WHY THIS EXISTS. `/contact` and `/follow` shipped for months unable to deliver
 * anything. The only provider was Web3Forms, keyed by
 * `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`; that secret was never created, GitHub
 * substituted an empty string for it without failing the build, and Next inlined
 * `""` at build time. Every submission threw before any network call and the
 * visitor was told "An error occurred. Please try again later."
 *
 * Nothing noticed. Unit tests mock the provider layer. The one e2e that submits
 * counted a red error banner as a pass and swallowed its own failure in a
 * `.catch(() => {})`. `smoke.yml` probed cache headers and asset retention. The
 * detector, in the end, was a rescue trying to tell us the listing form was broken
 * — using the contact form, which could not tell us either.
 *
 * WHAT THIS PROBES. The contact path now runs through this project's own Supabase
 * Edge Function (`contact-message`), which sends via Resend. That function checks
 * its own configuration FIRST, before it parses the body:
 *
 *   RESEND_API_KEY / CONTACT_TO / CONTACT_FROM missing  ->  500 "not configured"
 *   configured, but the body is empty                   ->  400 "name is required; ..."
 *
 * So an empty POST distinguishes "deliverable" from "will silently eat mail"
 * without sending anything. A 400 is the PASS here, which reads oddly and is the
 * whole point: it proves the request got past the configuration gate.
 *
 * SIDE EFFECTS: none. Validation runs BEFORE the rate limiter in that function
 * (deliberately, so malformed junk cannot burn a real sender's budget), so this
 * probe consumes no rate-limit budget and no Resend quota, and delivers no mail.
 *
 * WHAT IT DOES NOT COVER, so a green run is not mistaken for more than it is:
 *   - That CONTACT_TO is an address anyone reads. A typo'd but well-formed
 *     recipient passes this and still drops mail into nowhere.
 *   - That Resend will accept the send. The key's validity is only exercised by a
 *     real submission; this asserts the key is PRESENT, not that it works.
 *   - The Web3Forms fallback, which is now optional by design.
 */

const FUNCTION_PATH = '/functions/v1/contact-message';

const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const anon = process.env.SUPABASE_ANON_KEY ?? '';

if (!base || !anon) {
  console.error(
    '::error::check-contact-channel needs SUPABASE_URL and SUPABASE_ANON_KEY'
  );
  process.exit(1);
}

const url = `${base}${FUNCTION_PATH}`;

let response;
let payload = {};

try {
  response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    // Deliberately empty: enough to clear the configuration gate and be rejected
    // by validation. Never a plausible message, so nothing can be delivered.
    body: JSON.stringify({}),
  });
  payload = await response.json().catch(() => ({}));
} catch (error) {
  console.error(`::error::Could not reach the contact function at ${url}`);
  console.error(String(error));
  process.exit(1);
}

const detail =
  typeof payload?.error === 'string' ? payload.error : JSON.stringify(payload);

if (response.status === 400) {
  console.log(
    `Contact channel is configured and reachable (validation rejected the empty probe: ${detail})`
  );
  process.exit(0);
}

if (response.status === 500 && /not configured/i.test(detail)) {
  console.error(
    '::error::The contact function is deployed but NOT configured — it will accept submissions and deliver nothing.'
  );
  console.error(
    '::error::Set RESEND_API_KEY, CONTACT_TO and CONTACT_FROM as Edge Function secrets, then redeploy contact-message.'
  );
  process.exit(1);
}

if (response.status === 404) {
  console.error(
    `::error::The contact function is not deployed at ${url} — /contact and /follow cannot deliver.`
  );
  process.exit(1);
}

if (response.status === 401 || response.status === 403) {
  console.error(
    '::error::The Supabase gateway rejected the anon key before the contact function ran.'
  );
  process.exit(1);
}

console.error(
  `::error::Unexpected response from the contact function: ${response.status} ${detail}`
);
process.exit(1);
