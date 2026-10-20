#!/usr/bin/env node
/**
 * Fetch the screenshot attached to one customer report, into a gitignored directory.
 *
 * THE COUNTERPART TO A DELIBERATE OMISSION. `feedback-to-issues.mjs` records the storage
 * path in the issue and does NOT commit the bytes: a screenshot of this product can carry
 * an adopter's home address, phone number, landlord or vet details, or another person's
 * words in a message thread, and this repository is public. Auto-publishing that is
 * irreversible. So the picture is fetched by a person, when they pick up the ticket.
 *
 * IT USES THE SERVICE ROLE, which reads every folder in every bucket whatever RLS tells a
 * client — so it re-validates the path shape before building the URL, the third place that
 * check lives. Rows written before the database guards existed are still in the table.
 *
 * Usage:  pnpm feedback:shot <feedback-id>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAFE_PATH = /^[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\.(jpg|png|webp)$/;
const OUT_DIR = '.feedback-shots';

const id = process.argv[2];
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const die = (m) => {
  console.error(`FAIL: ${m}`);
  process.exit(1);
};

if (!id) die('give a feedback id: pnpm feedback:shot <id>');
if (!SUPABASE_URL || !SERVICE_KEY)
  die('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (node --env-file=.env)');

const auth = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

const rowRes = await fetch(
  `${SUPABASE_URL}/rest/v1/feedback?select=screenshot_path&id=eq.${encodeURIComponent(id)}`,
  { headers: auth }
);
if (!rowRes.ok) die(`reading feedback -> ${rowRes.status} ${await rowRes.text()}`);
const [row] = await rowRes.json();
if (!row) die(`no report with id ${id}`);
if (!row.screenshot_path) die(`report ${id} has no picture`);
if (!SAFE_PATH.test(row.screenshot_path))
  die(
    `report ${id} names a path this tool refuses to read: ${row.screenshot_path}\n` +
      '  It does not match {uuid}/{uuid}.{jpg|png|webp}. Not fetching it.'
  );

const bytes = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback/${row.screenshot_path}`, {
  headers: auth,
});
if (!bytes.ok) die(`fetching the object -> ${bytes.status} ${await bytes.text()}`);

mkdirSync(OUT_DIR, { recursive: true });
const ext = row.screenshot_path.split('.').pop();
const out = join(OUT_DIR, `${id}.${ext}`);
writeFileSync(out, Buffer.from(await bytes.arrayBuffer()));
console.log(`wrote ${out}`);
console.log(`${OUT_DIR}/ is gitignored — do not commit what is in it.`);
