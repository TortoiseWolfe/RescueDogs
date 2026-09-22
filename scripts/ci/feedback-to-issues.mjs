#!/usr/bin/env node
/**
 * Turn what a customer typed into a tracked issue, hourly, without anybody remembering to.
 *
 * WHY THIS EXISTS. The only route from a person to us was `/contact`, which reaches a human
 * inbox — and a bug report sitting in a mailbox is a bug report nobody is tracking. The
 * detector for the last contact-channel outage was a rescue trying to tell us the listing
 * form was broken, using the contact form, which could not tell us either
 * (`check-contact-channel.mjs` records that at length). This is the other half: a report
 * goes into Postgres and comes out as an issue, with no mailbox in between.
 *
 * IT IS NOT A GATE AND MUST NEVER BECOME ONE. Exiting non-zero because a customer found a
 * bug would make a green board a claim about customer silence. It exits 0 when there is
 * nothing to file — and FAILS when it cannot read the table, because "no reports" and "I
 * could not look" are different facts that look identical from the outside.
 *
 * NO DEPENDENCIES, Node built-ins only, the same rule every script in this directory
 * follows. It holds a database credential; a dependency surface is not something to add
 * around one.
 *
 * THE GITHUB TOKEN NEVER REACHES A SUPABASE SERVER. The Edge Functions in this project hold
 * a service role, which is this project's own secret; a token that can file an issue is a
 * credential for somebody else's system, and the narrowest one that posts to a tracker can
 * also read every private repo it is scoped to. So the filing happens here, in a job whose
 * `GITHUB_TOKEN` is the run's own and expires with it.
 *
 * DEDUPE READS THE ISSUES LIST, NEVER `search/issues`. Search is an index and is eventually
 * consistent, so a scheduled run and a manual dispatch firing on the same row would both
 * decide it was new and file it twice. The list endpoint reads the database.
 *
 * IT DOES NOT COMMIT THE SCREENSHOT, and that is the one deliberate departure from the
 * upstream version of this tool. Upstream commits the bytes into the repo and links them,
 * because a signed URL decays into a description of a picture nobody can see. Here the
 * pictures are different objects: a screenshot of this product can carry an adopter's home
 * address, phone number, landlord and vet details, or another person's words in a message
 * thread — and BOTH REPOS ARE PUBLIC. Auto-publishing that is irreversible. The issue
 * records the path; `pnpm feedback:shot <id>` fetches it locally into a gitignored
 * directory for whoever is working the ticket. The decay argument does not bite, because
 * that command reads the object directly with the service role rather than through a signed
 * URL — the durable reference is the path, and the bucket does not expire.
 *
 * Consequently this job needs `contents: read`, not `write`.
 *
 * Usage:  node scripts/ci/feedback-to-issues.mjs [--dry]
 */

const OWNER = 'TortoiseWolfe';
const REPO = 'RescueDogs';
const LABEL = 'from-a-customer';
const DRY = process.argv.includes('--dry');

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const GH_TOKEN = process.env.GITHUB_TOKEN ?? '';

/**
 * The same shape the CHECK constraint and the `feedback_guard` trigger police, applied a
 * THIRD time, here, before the string is ever interpolated into a URL.
 *
 * Not belt-and-braces: rows written before those guards existed are still in the table, and
 * `pnpm feedback:shot` fetches with the SERVICE ROLE, which reads every folder in every
 * bucket whatever RLS tells a client. A path out of `pet-photos` or `avatars` would be a
 * different person's file.
 */
const SAFE_PATH = /^[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\.(jpg|png|webp)$/;

function die(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) die(`GitHub ${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** Every report, oldest first. PostgREST with the project's own service key. */
async function reports() {
  const url =
    `${SUPABASE_URL}/rest/v1/feedback` +
    `?select=id,body,context,screenshot_path,created_at` +
    `&order=created_at.asc&limit=200`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  // A refusal WITH a key present is a hard failure, not a skip. Treating it as "nothing to
  // do" is how a channel goes quiet without anybody noticing.
  if (!res.ok) die(`reading feedback -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** Ids already filed, read from the issues LIST. Paged, because the list is capped. */
async function alreadyFiled() {
  const seen = new Set();
  for (let page = 1; page <= 10; page++) {
    const rows = await gh(
      `/repos/${OWNER}/${REPO}/issues?state=all&labels=${LABEL}&per_page=100&page=${page}`
    );
    for (const issue of rows) {
      const m = /<!-- app-feedback:([0-9a-fA-F-]{36}) -->/.exec(issue.body ?? '');
      if (m) seen.add(m[1]);
    }
    if (rows.length < 100) break;
  }
  return seen;
}

function title(body) {
  const first = (body ?? '').trim().split('\n')[0].trim();
  return `Customer: ${first.length > 65 ? `${first.slice(0, 65)}…` : first}`;
}

function issueBody(row) {
  const ctx = row.context ?? {};
  const facts = [
    ['Platform', ctx.platform],
    ['App', [ctx.app, ctx.build && `(${ctx.build})`].filter(Boolean).join(' ')],
    ['Route', ctx.route],
    ['Locale', [ctx.locale, ctx.timezone].filter(Boolean).join(' · ')],
    ['Sent', row.created_at],
  ].filter(([, v]) => v);

  const quoted = (row.body ?? '')
    .trim()
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');

  // THREE STATES, NOT TWO. "No picture" and "a picture whose path we refuse to touch" are
  // different facts, and collapsing them hides the only case worth investigating.
  let shot;
  if (!row.screenshot_path) shot = '_No picture._';
  else if (!SAFE_PATH.test(row.screenshot_path))
    shot = `⚠️ **A picture is attached under a path this tool refuses to read**: \`${row.screenshot_path}\`. It does not match \`{uuid}/{uuid}.{jpg|png|webp}\`, so it was not fetched. Rows written before the database guards existed can look like this; anything else is worth a look.`;
  else
    shot = `A picture is attached. Fetch it locally with:\n\n\`\`\`bash\npnpm feedback:shot ${row.id}\n\`\`\`\n\nIt is **not** committed here on purpose — a screenshot of this product can carry an adopter's address, phone, landlord or vet details, or another person's words, and this repository is public.`;

  return [
    quoted,
    '',
    '| | |',
    '| --- | --- |',
    ...facts.map(([k, v]) => `| **${k}** | ${v} |`),
    '',
    shot,
    '',
    '---',
    '',
    "The reporter has no GitHub account and cannot see this issue; there is no reply path back to them, by design — nothing identifying was collected.",
    '',
    "**This is a raw report, not a ticket.** The HOUSE RULE that every issue asking for a code change carries a paste-ready Cursor prompt applies to the tracking issue somebody opens once this is diagnosed — automation cannot write a prompt for a bug nobody has read yet.",
    '',
    `<!-- app-feedback:${row.id} -->`,
  ].join('\n');
}

async function ensureLabel() {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/labels/${LABEL}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (res.ok) return;
  await gh(`/repos/${OWNER}/${REPO}/labels`, {
    method: 'POST',
    body: JSON.stringify({
      name: LABEL,
      color: '0E8A16',
      description: 'Reported from inside the app by somebody with no GitHub account',
    }),
  });
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  die(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n' +
      '  In CI they come from repo secrets; locally use `node --env-file=.env`.'
  );
}
if (!DRY && !GH_TOKEN) die('GITHUB_TOKEN is required to file issues. Use --dry to preview.');

const rows = await reports();
const filed = DRY ? new Set() : await alreadyFiled();
const fresh = rows.filter((r) => !filed.has(r.id));

console.log(`${rows.length} report(s) in the table, ${fresh.length} not yet filed`);

if (!fresh.length) {
  console.log('nothing to file');
  process.exit(0);
}

if (DRY) {
  for (const row of fresh) console.log(`\n--- ${title(row.body)}\n${issueBody(row)}`);
  process.exit(0);
}

await ensureLabel();
for (const row of fresh) {
  const issue = await gh(`/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title: title(row.body), body: issueBody(row), labels: [LABEL] }),
  });
  console.log(`filed #${issue.number}  ${issue.html_url}`);
}
console.log(`\nAll: https://github.com/${OWNER}/${REPO}/issues?q=label%3A${LABEL}`);
