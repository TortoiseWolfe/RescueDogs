# Customer feedback → tracked issue

A signed-in person tells us the software is broken; within the hour it is a GitHub issue with
the `from-a-customer` label. No mailbox in between, and nothing identifying collected.

Ported from [TortoiseWolfe/runit](https://github.com/TortoiseWolfe/runit) (#77), where it
replaced a channel that only existed for TestFlight builds.

## Why it is not `/contact`

`/contact` is for a person writing **to the rescue**. It reaches a human inbox through the
`contact-message` Edge Function, and it asks for a name and an email because somebody is
going to write back.

This is a person telling **us** the software is broken. No name, no address, no reply path,
and it becomes a tracked issue without anybody reading a mailbox. Two different
conversations; one form would blur them.

The detector for the last contact-channel outage was a rescue trying to tell us the listing
form was broken — using the contact form, which could not tell us either
(`scripts/ci/check-contact-channel.mjs` records that at length). This is the other half of
that lesson.

## The shape

| Piece                                | Where                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Table, policies, rate limit, storage | `supabase/migrations/20251006_complete_monolithic_setup.sql`, **CUSTOMER FEEDBACK** section |
| What travels, and what is shown      | `src/lib/feedback/device-facts.ts`                                                          |
| The send                             | `src/lib/feedback/submit.ts`                                                                |
| The sheet and its trigger            | `src/components/forms/FeedbackSheet/`, `src/components/atomic/FeedbackLink/`                |
| Hourly filer                         | `scripts/ci/feedback-to-issues.mjs`, `.github/workflows/feedback.yml`                       |
| Fetch one screenshot                 | `scripts/ci/feedback-shot.mjs` (`pnpm feedback:shot <id>`)                                  |
| RLS acceptance test                  | `tests/rls/feedback-rls.test.ts` (`pnpm test:rls`)                                          |

## Three things that are deliberately not the upstream version

### 1. Signed-in only. Do not enable anonymous sign-ins to "fix" this

Upstream accepts anonymous identities, because the person it most needs to hear from is the
one who cannot get into the party.

**This repo cannot take that.** `enable_anonymous_sign_ins = false` in `supabase/config.toml`,
and an anonymous Supabase user **is** the `authenticated` Postgres role. Turning it on would
hand any drive-by a JWT satisfying all **39** `TO authenticated` policies in the migration —
including this one, at roughly line 884:

```sql
CREATE POLICY "Authenticated users can search profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);
```

That is every user profile. Flipping the switch is a 39-policy audit, not a line item. A
signed-out visitor keeps `/contact`, which already works.

### 2. `split_part`, never `storage.foldername`

The avatar policies explain this around line 741: `storage.foldername(text)` creates a
`pg_depend` edge that stops Supabase replacing its own function, and storage-api crash-loops
on _"cannot drop function foldername(text) because other objects depend on it"_ forever.
Upstream's policy uses `foldername`; it must not cross.

### 3. Screenshots are **not** committed to the repo

Upstream commits the bytes and links them, because a signed URL decays into a description of
a picture nobody can see.

Here the pictures are different objects. A screenshot of this product can carry an adopter's
home address, phone number, landlord or vet details, or another person's words in a message
thread — and **this repository is public**. Auto-publishing that is irreversible.

So the issue records the path, and a maintainer runs `pnpm feedback:shot <id>` to pull it into
`.feedback-shots/`, which is gitignored. The decay argument does not bite: that command reads
the object with the service role rather than through a signed URL, so the durable reference is
the path and the bucket does not expire. The workflow therefore needs `contents: read`, not
`write`.

## `screenshot_path` is guarded three times, and each guard catches what the others cannot

That column is interpolated into a storage URL and fetched **as the service role**, which
reads every folder in every bucket whatever RLS tells a client. Left as free text, a reporter
could name a path out of `pet-photos` or `avatars`.

1. **A CHECK constraint** on the shape — two uuids and a known extension. Catches a traversal
   written from inside a correct prefix.
2. **A `BEFORE INSERT` trigger** comparing the first path segment to `auth.uid()`. Catches a
   perfectly-shaped path belonging to somebody else. A CHECK cannot do this: it polices shape,
   not one column's meaning against another's.
3. **The tools re-validate** before interpolating, because rows written before the guards
   existed are still in the table.

**A BEFORE trigger runs ahead of a CHECK**, so a single test case would only ever exercise
whichever fires first. `tests/rls/feedback-rls.test.ts` tests each against the case only it can
catch — deliberately two tests, so a future simplification cannot delete one silently.

## Applying the migration

**The Supabase project `cmdhajshektesctrappl` belongs to `schlajo1981@gmail.com`'s org
(`Tech by Schlajo`)** — see `ACCOUNTS.md` in the workspace root. It is applied by whoever owns
it, via the Management API as this repo's CLAUDE.md describes. The SQL lives in the monolithic
file; nothing else has to change.

After applying, regenerate types and run the acceptance test:

```bash
docker compose exec rescuedogs pnpm run type-check
pnpm test:rls          # needs SUPABASE_SERVICE_ROLE_KEY; skips loudly without it
```

`src/lib/supabase/types.ts` needs the `feedback` table added to
`Database['public']['Tables']` or the insert in `submit.ts` fails `type-check`.

## The credential the workflow needs

`SUPABASE_FEEDBACK_KEY`, a **dedicated** service key for this job alone:

```bash
gh secret set SUPABASE_FEEDBACK_KEY --repo TortoiseWolfe/RescueDogs
```

The `--repo` flag is not optional — `gh secret` reads the parent ScriptHammer repo otherwise
(CLAUDE.md records that).

**Do not reuse the existing `SUPABASE_SERVICE_ROLE_KEY` secret.** `ci.yml` deliberately
withholds that key from the test job (#298); sharing one would mean revoking the feedback
reader also breaks E2E, and rotating it for E2E silently breaks this. One key, one job,
revocable alone.

## What this does not cover

- **That anybody reads the issues.** The label exists; nothing pages anyone.
- **Delivery timing.** The cron is hourly at `:17`; GitHub delays scheduled runs, sometimes by
  a lot. An urgent report is not an urgent alert.
- **Signed-out visitors.** They reach `/contact` instead. Closing that gap means either an
  Edge Function with its own IP rate limit (modelled on `contact-message`) or the 39-policy
  anonymous-auth audit above. Neither is in this work.
- **Whether the screenshot is what the reporter thought they were sending.** The picker opens
  the library and never the camera, and the browser has no crop step — the sheet says so,
  rather than papering over it.
