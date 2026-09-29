# Code Review Backlog — full repository

Whole-repo review (not a diff review) run on 2026-09-29 against `claude/zealous-hamilton-32oetx`
at `d40085c`. Findings come from reading code; nothing was executed. Each reviewer verified every
candidate against callers, guards, RLS policies and tests before reporting it.

## Severity legend

| Level | Meaning |
| ----- | ------- |
| **P0** | Security hole, data loss, auth bypass, money charged or lost |
| **P1** | User-facing bug on a real path, or a check/test that hides real failure |
| **P2** | Latent bug, edge case, wrong under some configuration |
| **P3** | Minor / robustness |

## Summary

**71 findings: 7 P0 · 18 P1 · 31 P2 · 15 P3.** Eight reviewers covered all code tiers (see Coverage). Duplicates across reviewers are merged and each entry lists every source. Re-grades carry a "Severity note". All 9 findings from the earlier quick pass reappear here, independently confirmed.

### Themes worth fixing as a class

1. **RLS write policies with no column limits or WITH CHECK.** The same shape appears on `messages`, `conversations`, `user_connections`, `conversation_members`, `group_keys`, `user_profiles` and `subscriptions`. A row-ownership check is treated as if it were permission to change every column. This one pattern accounts for message forgery, forced connections, group takeover, self-set `is_admin` and forged subscriptions. **Fix as a class:** audit every `FOR UPDATE`/`FOR INSERT` policy in the monolithic migration. Replace `GRANT ALL` with column-level `GRANT UPDATE (…)`, or add BEFORE UPDATE triggers that freeze identity and state columns. Route state changes through SECURITY DEFINER RPCs, as applications already do.
2. **One Supabase project serves production, development and CI.** Because of that, a public test password becomes a live admin login, every E2E run wipes production lockouts, `db:reset` can delete real adopters, and the public demo manager can see real applicants. **Fix as a class:** run CI against a local Supabase stack (which also unblocks theme 4), and never seed known credentials or demo tenants into prod.
3. **Security and integrity rules that live only in the client.** Examples: the sign-in lockout, the "pet has applications" delete guard, the pet status the edit form writes back, the admin UI gate, and consent checks (Disqus, analytics, the nav theme toggle). The app is a static export, so the constitution already puts trust in the database. Move each of these into a trigger, RPC or policy, and treat the UI check as copy only.
4. **Tests and checks that cannot fail.** The RLS suite never runs in CI, the security E2E job is `continue-on-error`, RLS asserts pass vacuously, specs turn errors into skips, and some tests are `expect(true).toBe(true)` placeholders. Several of the P0/P1 bugs above sit in exactly those untested paths. Also, no secret scan runs server-side, and `monitor.yml` can never go red.
5. **Failure reported as success, or silently dropped.** Account deletion deletes nothing but redirects as if it did. Webhooks dedupe failed events forever. Load errors render as "not found", a rate-limit outage renders as "account locked", and a failed status change discards the staff note. **Fix as a class:** check the affected row count on writes, and show the real error.

### Unverified — needs a human check

- **Live project state:** whether `supabase/seed-admin-demo.sql` (admin flag on `test@example.com`) and `seed-rescue-demo.sql` have been applied to `cmdhajshektesctrappl`. This decides the practical impact of two P0s. Check it first.
- **Committed `.env.local-supabase`:** confirm it contains only the standard local-Supabase demo JWTs, not real project keys. Two attempts to read it were blocked by the environment's permission policy.
- **Default `GITHUB_TOKEN` permissions:** `ci`, `accessibility`, `e2e` and `component-structure` have no `permissions:` block, so the repository setting decides.
- **Admin date ranges (T6 lead, not verified):** `src/app/admin/*/page.tsx` pass `new Date('YYYY-MM-DD')` (midnight UTC) as the range end, which may drop the last day's data. Out-of-order range responses aren't guarded.

## Coverage

| Tier | Scope | Status |
| ---- | ----- | ------ |
| T1 | DB schema/RLS, edge functions, auth, payments, contexts, schemas | done |
| T2 | Messaging, E2E crypto, offline queue, service worker | done |
| T3 | Adoption domain: applications, pets, photos, admin, portal, browse, email | done |
| T4 | Pages/routing (`src/app`), hooks, utils, config, SEO/blog/monitoring libs | done |
| T5 | UI components — security-sensitive (auth, payment, privacy, forms, messaging) | done |
| T6 | UI components — the rest | done |
| T7 | `scripts/`, CI workflows, Docker, hooks, build config | done |
| T8 | Tests (`tests/`, `src/tests`, `scripts/__tests__`) | done |

Not reviewed (prose, not code): `docs/`, `features/`, `specs/`, `.specify/`, `.claude/`, `public/blog`, wireframe SVGs.

## P0

### [P0] `messages` UPDATE policies have no column limits — forge, hide or move messages
- **Where:** `supabase/migrations/20251006_complete_monolithic_setup.sql:2048-2076` ("Users can edit own messages", "Recipients can mark messages as read"); `GRANT ALL ON messages TO authenticated` `:2267`; client-only checks `src/services/messaging/message-service.ts:1117-1160`
- **Defect:** The recipient "mark as read" policy permits updating every column of a received message. The sender policy's WITH CHECK tests `created_at > now()-15m` against the *new* row, so the same UPDATE can reset `created_at`. No trigger freezes any column.
- **Failure scenario:** B PATCHes A's message with new `encrypted_content`/`initialization_vector`. B holds the ECDH secret, so the forgery decrypts cleanly and shows as A's words. B can also set `deleted=true` to hide A's messages. A sender can PATCH `conversation_id` into a conversation they aren't in (including `is_system_message=true`), or reset `created_at` to edit forever.
- **Fix:** Replace the recipient policy with a SECURITY DEFINER `mark_messages_read(ids)` RPC, or add a BEFORE UPDATE trigger that allows non-senders to change only `read_at`/`delivered_at`. For senders, freeze `conversation_id`, `sender_id`, `created_at`, `sequence_number` and `is_system_message`, and check the window against `OLD.created_at`.
- **Confidence:** confirmed · **Source:** T2 + T1 (merged; also in the earlier diff-review pass)

### [P0] Connection consent and blocking are enforced only in the client
- **Where:** migration `:1898-1904` (`user_connections` INSERT checks only `auth.uid() = requester_id`; the addressee UPDATE has no column limits); `:1972-1975` (`conversations` UPDATE only requires the caller to stay a participant); `:2534-2550` (`messages` INSERT ignores `status='blocked'`); `src/services/messaging/connection-service.ts:597-613` (`ensureAcceptedConnection` inserts `status:'accepted'` directly)
- **Defect:** Any user can create an *accepted* connection with anyone. An addressee can rewrite `requester_id`, a participant can swap the other participant of a 1:1 conversation, and a blocked user keeps insert rights on the existing conversation.
- **Failure scenario:** M inserts `{requester_id:M, addressee_id:V, status:'accepted'}`, opens a conversation and messages V, who never consented. After V blocks M, M's messages still pass RLS. In an A–B conversation, A PATCHes `participant_2_id=C`: B loses the history and C gains the ciphertext rows.
- **Fix:** Require `status='pending'` on INSERT and move the staff auto-link (#72) into a SECURITY DEFINER RPC that verifies the relationship. Restrict `user_connections` UPDATE to `status`, freeze the `conversations` participant columns, and add a NOT EXISTS blocked check to `messages` INSERT.
- **Confidence:** confirmed · **Source:** T2 + T1 (merged; also in the earlier diff-review pass)
- **Severity note:** Raised from P1. This bypasses consent and blocking, which is an authorization hole and a harassment vector, not just a UX bug.

### [P0] Public demo-manager login can read real applicants' PII
- **Where:** `src/lib/portal/portal-preference.ts:96-102` (`DEMO_CREDENTIALS` shipped in the bundle); `supabase/seed-rescue-demo.sql:65-67` (staff@demo.test is `manager`), `:87-100` (demo pets `available`); `src/services/applications/application-service.ts:66-80,125-157` (browse and adopt don't exclude the demo shelter)
- **Defect:** The demo shelter's pets are listed on public browse and in the `/adopt` dropdown next to real pets, and the password for that shelter's manager is public.
- **Failure scenario:** A real adopter applies to the demo pet "Tiger". Anyone who clicks "try the demo" as staff can read that adopter's snapshot (address, phone, household, landlord, vet), pull their login email with `get_application_applicant_email`, and change their status. The same login can also rename the rescue, repoint its `contact_email`, and use `add_shelter_staff_by_email` as an email oracle.
- **Fix:** Exclude demo-shelter pets from browse and adopt for non-demo users, and block INSERT on demo pets for non-demo adopters in RLS. Demote the demo account to `staff`, or back it with a sandboxed shelter that is reset on a schedule.
- **Confidence:** confirmed in code. That the demo is seeded in prod is plausible: the seed's photo URLs point at the prod project. · **Source:** T3
- **Severity note:** Raised from P1. Anyone can read real applicants' PII with a public credential.

### [P0] E2E deletes every production `rate_limit_attempts` row, clearing real lockouts
- **Where:** `tests/e2e/utils/rate-limit-admin.ts:47-50` (`.delete().gte('id','00000000-…')`), called from `tests/e2e/auth/rate-limiting.spec.ts:65` and `tests/e2e/security/brute-force.spec.ts:96`; runs in the `rate-limiting` job, `.github/workflows/e2e.yml:406`, on every push, PR and the cron
- **Defect:** It deletes every row in the single shared Supabase project (`cmdhajshektesctrappl`, which also backs raisedpaws.com), not just this run's test identifiers.
- **Failure scenario:** An attacker is locked out of a real account after 15 failed sign-ins. The next E2E run from any push or PR deletes the lockout, giving them another 15 guesses. IP-keyed rows reset the same way.
- **Fix:** Delete only this run's identifiers (`clearRateLimitsForIdentifier` already exists), or a test-only pattern such as `+bf-`/`+rl-` matched with `ilike`. Never delete all rows in a shared project.
- **Confidence:** confirmed · **Source:** T8
- **Severity note:** Raised from P1. Production brute-force protection is reset on every CI run.

### [P0] Test account with a public password is made platform admin on the shared project
- **Where:** `supabase/migrations/20251006_complete_monolithic_setup.sql:21, 1771-1867` (recreates `test@example.com` / `TestPassword123!`); `supabase/seed-admin-demo.sql:320-329` (adds `{"is_admin": true}` to that user's `raw_app_meta_data`); `scripts/generate-contract-fixtures.ts:8-9`; the password is also published in `CLAUDE.md`
- **Defect:** There is one Supabase project (`cmdhajshektesctrappl`), and it serves raisedpaws.com. The migration re-creates a user whose password is in the public repo, and the admin seed grants that user the JWT admin claim that every `admin_*` RPC and admin RLS policy trusts.
- **Failure scenario:** Anyone signs in on raisedpaws.com as `test@example.com` and gets `app_metadata.is_admin`. That opens the admin user list, payment data and audit logs, including sign-up emails and IP addresses in `event_data`.
- **Fix:** Never seed a known-password user or an admin claim into the production project. On the live project, rotate the password or delete the user and strip `is_admin` from its app_metadata. Point E2E at a separate project or local stack.
- **Confidence:** confirmed code path. Whether `seed-admin-demo.sql` has been applied to the live project couldn't be checked from here: **check this first.** · **Source:** T1, verified by the orchestrator
- **Note:** Line 21 also runs `DELETE FROM auth.users WHERE email='test@example.com'` on every re-run of the migration, cascading that account's data.

### [P0] Payment webhooks lose events for good when processing fails once
- **Where:** `supabase/functions/stripe-webhook/index.ts:55-69, 481`; `supabase/functions/paypal-webhook/index.ts:72-83`
- **Defect:** The event row is inserted with `processed=false` *before* processing, and the dedupe check only asks whether a row exists. After a 500, every provider retry gets 200 "already processed".
- **Failure scenario:** Stripe status `incomplete` maps to `'pending'`, which violates the `subscriptions.status` CHECK (migration `:115`). The upsert throws and the retry is deduped, so the event is lost. Any transient DB error on `payment_intent.succeeded` does the same: the customer is charged and no `payment_results` row is ever written.
- **Fix:** Dedupe only on `processed=true`, or mark the row failed and reprocess on retry. Map statuses only to values the CHECK allows.
- **Confidence:** confirmed · **Source:** T1
- **Severity note:** Raised from P1. Customers can be charged with no record kept.

### [P0] PayPal subscription webhook can never insert a row — users billed with no record
- **Where:** `supabase/functions/paypal-webhook/index.ts:173, 188, 259-293`; `supabase/functions/create-paypal-subscription/index.ts:26-30, 51`
- **Defect:** The insert omits `template_user_id`, which is NOT NULL (the docs say it's read from `resource.custom_id`, but it isn't). `plan_interval` is taken from `tenure_type` (`regular`/`trial`), which fails the `month`/`year` CHECK. `APPROVAL_PENDING` maps to the invalid status `'pending'`. Signature verification is hard-coded to live `api-m.paypal.com` while the other functions use `PAYPAL_API`.
- **Failure scenario:** A buyer subscribes and the ACTIVATED webhook throws 23502/23514. Because of the finding above, it's never retried. The user is billed monthly, has no subscription row, and can't cancel in the app. In sandbox, every webhook fails signature verification.
- **Fix:** Set `template_user_id` from a validated `custom_id`, derive the interval from the plan, map statuses only to allowed values, and use `PAYPAL_API` for verification.
- **Confidence:** confirmed. It matters only if PayPal subscriptions are enabled in production. · **Source:** T1
- **Severity note:** Raised from P1 (money charged with no record).

## P1

### [P1] Security E2E (brute-force and rate-limit) runs only in a job that can't fail
- **Where:** `.github/workflows/e2e.yml:331-336` (`rate-limiting` job, `continue-on-error: true`); `playwright.config.ts:220-226` (every `*-gen` project ignores both specs); downstream gates `needs['rate-limiting'].result == 'success'` at `e2e.yml:767, 938`
- **Defect:** The only place `brute-force.spec.ts` (REQ-SEC-003) and `rate-limiting.spec.ts` run is a job whose failure never turns the workflow red, and E2E isn't a required check anyway. When that job fails, the firefox/webkit full-matrix jobs are also skipped without notice.
- **Failure scenario:** A change to `src/lib/auth/rate-limit-check.ts` or `SignInForm` stops lockout from triggering. Both specs fail 3/3, and the PR and `main` stay green.
- **Fix:** Remove the job-level `continue-on-error` and fix the flake at its cause (see the all-rows wipe P0). If the job stays advisory, take it out of the firefox/webkit `if:` gates.
- **Confidence:** confirmed · **Source:** T7 + T8 (merged)

### [P1] The application/payment/audit RLS suite never runs in CI
- **Where:** `vitest.config.ts:48-52` excludes `tests/rls/**`; `pnpm test:rls` (`package.json:83`) isn't called from any workflow; `ci.yml:18-36` withholds `SUPABASE_SERVICE_ROLE_KEY`, so `describe.skipIf(!hasRlsTestEnvironment())` would skip anyway
- **Defect:** None of the tests for Constitution Principle III run automatically: tenant isolation on applications, status-RPC transition rules, one approval per pet (#34), payment isolation and audit immutability.
- **Failure scenario:** A migration edit drops the `applications` tenant SELECT policy. Unit tests mock Supabase and pass, E2E doesn't probe it, and it ships.
- **Fix:** Add a CI job that starts local Supabase, applies the monolithic migration and seed, runs `pnpm test:rls` with the local service key, and make it required.
- **Confidence:** confirmed · **Source:** T8

### [P1] RLS tests that pass vacuously or only check through the service role
- **Where:** `tests/rls/group-isolation.test.ts:113-160` (the self-join regression is tested only by calling `is_conversation_creator` with the service client, and the outsider never attempts the insert); `:134-147` (`data ?? []` turns errors into passes, and there is no owner positive control); `tests/rls/application-rls.test.ts:268-288` (the result of the setup upsert is never checked); `tests/rls/audit-immutability.test.ts:80-92`, `service-role.test.ts:133-145` (B has no seeded audit rows)
- **Defect:** None of these assertions can fail when the policy under test is broken.
- **Failure scenario:** The `conversation_members` INSERT policy is loosened to `WITH CHECK (user_id = auth.uid())`, which allows the self-join, or audit SELECT becomes `USING (true)`. Every test still passes.
- **Fix:** Have the outsider really attempt the insert and assert an error. Assert `error` is null on setup writes, seed B's rows, and add positive controls for owner access.
- **Confidence:** confirmed · **Source:** T8

### [P1] Payment-isolation E2E (REQ-SEC-001) asserts nothing about isolation
- **Where:** `tests/e2e/security/payment-isolation.spec.ts:113-157, 159-178`
- **Defect:** The "only own payments" test passes if either the empty state or any payment item is visible. The "unauthenticated" test runs under an authenticated `storageState` (`playwright.config.ts:229`), and its fallback assertion is always true right after `goto('/payment-demo')`.
- **Failure scenario:** `PaymentHistory` loses its user filter, or the `payment_intents` SELECT policy is widened. User A sees user B's payments and both tests stay green.
- **Fix:** Seed a payment for B with the admin client and assert it is absent from A's page. For the anonymous test, use an empty `storageState` and assert the redirect.
- **Confidence:** confirmed · **Source:** T8

### [P1] Pet edit form writes back a stale `status`, undoing an approval or adoption
- **Where:** `src/app/shelter/pets/edit/page.tsx:205-216` (always sends `status`), `:115` (a restored draft brings back an old status); `src/services/applications/shelter-pet-service.ts:98`; RLS "Shelter staff update pets" (migration ~`:4054`) accepts any status
- **Defect:** `pets.status` is driven by `advance_application_status` and `finalize_adoption`, but the edit form re-sends the value it loaded on every save. The DB doesn't check it against application state.
- **Failure scenario:** Staff open Tiger's edit page to fix the bio. Meanwhile an application is approved (pet → `pending`) or finalized (→ `adopted`). The bio save writes `available`. The pet is relisted, and new applicants apply who can never be approved (Principle I limbo).
- **Fix:** Send `status` only when the user changed it. Add a BEFORE UPDATE trigger on `pets` that rejects un-pending or un-adopting while an `approved` application exists, unless the change comes through the RPCs.
- **Confidence:** confirmed · **Source:** T3 + T4 (merged; also in the earlier diff-review pass). T4 adds that `becomingAdopted` compares against the same stale `pet.status`, and suggests a conditional update (`.eq('status', loadedStatus)`) that reports "changed elsewhere" when 0 rows match.

### [P1] Deleting a pet cascade-deletes its applications; the guard exists only in the UI
- **Where:** migration `:3097` (`applications.pet_id … ON DELETE CASCADE`), `:4060` (staff DELETE policy); `src/app/shelter/pets/edit/page.tsx:229` (count taken at page load); `src/services/applications/shelter-pet-service.ts:147`
- **Defect:** The rule that a pet with applications can't be deleted lives only in client state, while the foreign key cascades.
- **Failure scenario:** The edit page loads with 0 applications, then an adopter applies, then staff click Delete. The application and its history vanish, and the adopter's tracker shows "not found" (Principle I ghosting). A direct API DELETE does the same thing at any time.
- **Fix:** Use `ON DELETE RESTRICT`, or add a BEFORE DELETE trigger that raises when applications exist.
- **Confidence:** confirmed · **Source:** T3 + T1 (merged; also in the earlier diff-review pass)
- **Severity note:** Raised from P2. This is silent loss of adopters' data.

### [P1] Rescue founder's login email is made world-readable
- **Where:** migration `:3316-3318` (`create_my_shelter` defaults `contact_email` to `auth.users.email`), `:4027` ("Public can view shelters", anon, all columns); `src/app/shelter/RescueProfileFields.tsx:114` (field hidden on the create form)
- **Defect:** The create form never shows the field. The RPC fills in the founder's private login email, and anon can read every column.
- **Failure scenario:** `GET /rest/v1/shelters?select=name,contact_email` with the public anon key returns every founder's sign-in email.
- **Fix:** Leave it NULL unless explicitly entered, and give anon a column-limited view without `contact_email`.
- **Confidence:** confirmed · **Source:** T3
- **Severity note:** Raised from P2. This is a PII leak to unauthenticated callers.

### [P1] Unverified shelter `contact_email` turns application notifications into a spam relay
- **Where:** migration `:3259-3342`, `:3350-3435` (`create_my_shelter`/`update_my_shelter` accept any address); `supabase/functions/notify-shelter-application/index.ts:92-160`
- **Defect:** Any user can create a rescue that points at any address, and every application INSERT sends a branded Resend email there. The shelter name, pet name and applicant name in it are all attacker-chosen.
- **Failure scenario:** An attacker creates a rescue with `contact_email=victim@x.com` and a spam name, adds N pets, and applies to each. N emails go from the verified domain to someone who never consented, with no rate limit. This repeats the #353 abuse pattern.
- **Fix:** Verify the contact address before sending, or send only to confirmed member accounts, and rate-limit notifications per shelter.
- **Confidence:** confirmed · **Source:** T3
- **Severity note:** Raised from P2. It harms the sending domain's reputation and is a known abuse pattern here.

### [P1] Shared-secret cache ignores recipient key rotation — messages become permanently unreadable
- **Where:** `src/services/messaging/message-service.ts:82-83, 268-302`; `src/services/messaging/key-service.ts:987-997` (`activeKeyIdCache`)
- **Defect:** `sharedSecretCache` is keyed only by recipient id and is cleared only when the *sender's* key changes. Recipients rotate keys on every IndexedDB miss: a new device, a private window, or cleared site data.
- **Failure scenario:** A has a conversation open in a long-lived tab and B signs in on a phone. Every message A sends afterwards is encrypted to B's revoked key, and B sees "Encrypted with previous keys" forever. `recipient_key_id` records the stale id, so the #147 diagnostic also misreports.
- **Fix:** Key the cache by `(recipientId, recipientKeyId)` and re-check the active key id online before using a cached secret.
- **Confidence:** confirmed · **Source:** T2

### [P1] Plaintext of queued "end-to-end encrypted" messages is kept in IndexedDB indefinitely
- **Where:** `src/services/messaging/message-service.ts:334-341, 506-513`; `src/services/messaging/offline-queue-service.ts:59-77, 231-235`; the comments claiming ciphertext at `src/hooks/usePendingMessages.ts:10` and `ConversationView.tsx:220`
- **Defect:** Offline or failed sends store the cleartext. Once synced, the rows are only flagged, and nothing calls `clearSyncedMessages`. Sign-out doesn't clear the queue.
- **Failure scenario:** On a shared shelter computer, anyone can later open DevTools → IndexedDB and read the plaintext messages.
- **Fix:** Don't persist `content`. Delete rows once they sync, and clear the queue and cache on sign-out.
- **Confidence:** confirmed · **Source:** T2

### [P1] The 10-second message poll drops older pages and resets the cursor
- **Where:** `src/components/organisms/ConversationView/ConversationView.tsx:235-243`, `:155-170, 206-208`
- **Defect:** Every poll calls `loadMessages()` with `loadMore=false`, which replaces the list with the newest 50 and resets `cursorRef`.
- **Failure scenario:** A user in a thread with more than 50 messages clicks "load more". The older messages disappear within 10 seconds, so the user can never read past the latest page.
- **Fix:** Poll only for messages newer than the highest `sequence_number` seen, and merge them in.
- **Confidence:** confirmed · **Source:** T2

### [P1] Group chat can't work under the current RLS, and its E2E test hides that
- **Where:** `src/services/messaging/group-service.ts:150-165, 358-371, 404-409, 684-697, 763-766, 795-797`; migration `:1933-1975`, `:2319-2331`; `tests/e2e/messaging/group-chat-multiuser.spec.ts:170-180`
- **Defect:** None of the `conversations` policies can match a group row (participants are NULL), so creating a group fails with 42501. Rename and delete affect 0 rows, and there's no DELETE policy. `'member_added'` isn't in `check_system_message_type`, and that error is swallowed.
- **Failure scenario:** Create Group always errors. The E2E test sees the failure and navigates away ("backend may be partial"), so CI stays green.
- **Fix:** Add group-aware policies using `is_conversation_member`/`is_conversation_creator`, add `'member_added'` to the CHECK, and make the E2E test assert that the group was created.
- **Confidence:** confirmed · **Source:** T2 + T1 (merged)

### [P1] Root ErrorBoundary never resets on client-side navigation
- **Where:** `src/app/layout.tsx:188-192`; `src/components/ErrorBoundary.tsx:83-85, 88-109`; there is no `app/error.tsx`
- **Defect:** The boundary lives in the persistent root layout with `level="page"`, receives no `resetKeys`, and auto-resets only when `level` is `component`.
- **Failure scenario:** One page throws, and after that every page the user navigates to via GlobalNav or Footer shows "Page Error" until a full reload.
- **Fix:** Pass `resetKeys={[pathname]}` from a client wrapper, or add `app/error.tsx`.
- **Confidence:** confirmed · **Source:** T6

### [P1] "Delete my account" reports success but deletes nothing
- **Where:** `src/services/messaging/gdpr-service.ts:434-449`; `src/components/molecular/AccountDeletionModal/AccountDeletionModal.tsx:65-69`; `user_profiles` policies (migration `:898-914`) have no DELETE policy
- **Defect:** RLS turns the DELETE into 0 rows with no error. The code comment claims deleting the profile cascades to `auth.users`, but the foreign key runs the other way.
- **Failure scenario:** The user confirms deletion, sees a success redirect and is signed out. The profile, auth account, messages, applications, the snapshot of their personal details held on each application, and the adopter profile all remain, and they can sign straight back in. That's a GDPR erasure claim the app doesn't honour. `tests/e2e/messaging/gdpr-compliance.spec.ts:~452-461` checks only the redirect, and `tests/contract/profile/delete-account.contract.test.ts:115` is `expect(true).toBe(true)`.
- **Fix:** Add an Edge Function that uses `auth.admin.deleteUser`, or a SECURITY DEFINER `delete_my_account()` that deletes from `auth.users`. Check the affected row count, and make the E2E test assert the user can no longer sign in.
- **Confidence:** confirmed · **Source:** T1 + T5 (merged)

### [P1] Rate limiter resets under concurrency; the contact form's limit is keyed on a spoofable header
- **Where:** migration `:623-637` (`check_rate_limit` with `FOR UPDATE SKIP LOCKED`); `supabase/functions/contact-message/index.ts:25, 72-80`
- **Defect:** A concurrent caller that hits the lock gets no row, takes the "new window" branch, and resets `attempt_count=0, locked_until=NULL`. The contact function keys on the first `X-Forwarded-For` entry, which the client controls, instead of `cf-connecting-ip`. The doc says 5 per 15 minutes, but the SQL cap is 15.
- **Failure scenario:** Parallel bursts keep resetting the counter, so neither the sign-in nor the contact limit is ever reached. Rotating the XFF value gives a fresh budget on every request.
- **Fix:** Use a plain `FOR UPDATE`, or a single atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`. Key on the proxy-appended or `cf-connecting-ip` address, and fix the limit or the doc.
- **Confidence:** confirmed (reset logic); plausible (XFF spoofing depends on the gateway) · **Source:** T1 (also in the earlier diff-review pass)

### [P1] Sign-in lockout is client-only: anyone can lock a victim out, and attackers bypass it
- **Where:** migration `:489-604` (`log_auth_audit_event`, granted to anon, takes any `p_user_id`), `:607-674` (`check_rate_limit`/`record_failed_attempt`, SECURITY DEFINER, no REVOKE); `src/components/auth/SignInForm/SignInForm.tsx:84-101, 143-147`; `SignUpForm.tsx:81`; `ForgotPasswordForm.tsx:52`
- **Defect:** Only the client increments the per-email counter, anon can increment it for any email, and only the form enforces the lock before it calls GoTrue. Identifiers are case-sensitive.
- **Failure scenario:** An attacker calls `rpc('record_failed_attempt', {p_identifier:'victim@x.com', …})` 15 times every 15 minutes, and the victim's form says "account locked" indefinitely. Meanwhile the attacker brute-forces via `signInWithPassword` directly, which never touches the counter. Anyone can also forge `sign_in_failed`/`account_delete` audit rows for any user.
- **Fix:** Enforce lockout where the password is checked (an Auth hook, or an Edge Function that proxies sign-in). REVOKE these functions from anon/authenticated, force `p_user_id = auth.uid()`, and lowercase identifiers.
- **Confidence:** confirmed · **Source:** T1 + T5 (merged)
- **Severity note:** T1 and T5 graded this P2. It's raised to P1 because a real user-facing lockout DoS is live, and the brute-force protection is illusory apart from GoTrue's own limits.

### [P1] `subscriptions` is writable by the client in every column
- **Where:** migration `:875-880, 1754`; `src/lib/offline-queue/payment-adapter.ts:203-209`; `supabase/functions/cancel-subscription/index.ts` and `resume-subscription` act on the stored `provider_subscription_id` with platform keys
- **Defect:** The INSERT and UPDATE policies only pin `template_user_id`.
- **Failure scenario:** A user sets their own row to `status='active'` with any amount. Or they insert a fake live row, so the real webhook upsert hits `idx_subscriptions_one_live_per_user` and the real subscription is never recorded. Or they point `provider_subscription_id` at another customer's id and call cancel/resume, which the platform's Stripe/PayPal credentials then carry out.
- **Fix:** Remove client INSERT and UPDATE on `subscriptions`, so only webhooks and edge functions using the service role write it.
- **Confidence:** confirmed · **Source:** T1
- **Severity note:** Raised from P2. It can block recording real subscriptions and act on other customers' provider subscriptions (if their id is known).

### [P1] ProtectedRoute drops the query string from `returnUrl`, breaking every deep link
- **Where:** `src/components/auth/ProtectedRoute/ProtectedRoute.tsx:57-59, 105, 111` (uses `usePathname()` only)
- **Defect:** Static export means every detail page is keyed by a query param (`?id=`, `?pet=`, `?conversation=`), and those are lost.
- **Failure scenario:** A signed-out manager clicks the new-application email link `…/shelter/application?id=<uuid>` (`supabase/functions/notify-shelter-application/index.ts:140`), signs in, and sees "Application not found". The same happens for `/applications/status?id=`, `/adopt?pet=` (the Apply button loses the pet), `/shelter/pets/edit?id=`, `/messages?conversation=` and `/payment-result?id=`.
- **Fix:** Build `returnUrl` from `pathname + window.location.search`. The sign-in side already validates same-origin.
- **Confidence:** confirmed · **Source:** T4

## P2

### [P2] Group members can un-remove themselves, self-promote to owner, and plant key rows
- **Where:** migration `:2476-2481` (`conversation_members` UPDATE: no WITH CHECK, no column limits), `:2499-2504` (`group_keys` INSERT checks only membership)
- **Defect:** A member can change their own `role`, `left_at` and `key_status`. Any member can insert `group_keys` rows for any user or version.
- **Failure scenario:** A removed member sets `left_at=NULL` and `role='owner'`, regains read access, then rotates keys to include themselves. Or a member pre-inserts a junk key row for the victim's next version, so the real distribution hits the unique constraint and the victim can't decrypt.
- **Fix:** Let non-owners change only `archived`/`muted`, never allow clearing `left_at`, and require `created_by = auth.uid()` plus owner/RPC-only key distribution.
- **Confidence:** confirmed · **Source:** T2
- **Severity note:** T1 graded this P1. It is P0-class once group creation works, and P2 only while groups can't be created (see the group-chat P1). Fix both together.
- **Source:** T2 + T1 (merged)

### [P2] Offline message queue can send duplicates
- **Where:** `src/services/messaging/offline-queue-service.ts:135-245`; `src/services/messaging/message-service.ts:430-443, 499-513`
- **Defect:** The client UUID isn't used as the row id, so inserts aren't idempotent. There's no cross-tab claim, unlike `src/lib/offline-queue/base-queue.ts`.
- **Failure scenario:** Two tabs come back online and both send the queue, so each message arrives twice. Or the response to a committed insert is lost, and the retry plus the queue produce 2–3 copies.
- **Fix:** Insert with `id: queuedMsg.id`, treat a 23505 on the primary key as success, and claim items atomically as base-queue does.
- **Confidence:** confirmed (the frequency is plausible) · **Source:** T2

### [P2] Message queue's "failed" status never sticks — rows retry forever
- **Where:** `src/services/messaging/offline-queue-service.ts:173-178, 315-330`
- **Defect:** Marking a row failed doesn't persist `retries = MAX`, and `getQueue` returns failed rows as well.
- **Failure scenario:** A permanently rejected message (RLS 42501 after a block, or a stale `sender_id` after logout) is retried on every 30-second poll and focus event, with an 8-second inline sleep each time.
- **Fix:** Persist `retries`, exclude `failed` rows and rows from other senders, and don't queue non-network errors.
- **Confidence:** confirmed · **Source:** T2

### [P2] Offline message history never works, and the cache holds the wrong page in the wrong order
- **Where:** `src/services/messaging/message-service.ts:582-605, 650-667`; `src/lib/messaging/cache.ts:59-69, 97-108`
- **Defect:** Offline, the unconditional `conversations` lookup throws "Conversation not found". Each fetched page replaces the whole cache, and cached reads are ordered by a random UUID.
- **Failure scenario:** A user who goes offline and reopens a thread gets an error instead of the cached history. Even with that fixed, the messages would be shuffled and could be the wrong page.
- **Fix:** Resolve the conversation from the cache when offline, `bulkPut` instead of replacing, and index and sort on `[conversation_id+sequence_number]`.
- **Confidence:** confirmed · **Source:** T2

### [P2] Reopening then closing an application leaves the pet stuck in `pending`
- **Where:** migration `:3649-3656` (`advance_application_status` pet sync), `:3713-3746` (`withdraw_application` never touches `pets`)
- **Defect:** The pet goes back to `available` only when an application leaves `approved` directly.
- **Failure scenario:** An application goes approved → under_review → not_selected, or the adopter withdraws. The pet stays `pending`, hidden from browse, and every new application is blocked, with no signal to staff.
- **Fix:** Whenever an application closes, if no other `approved` application exists and the pet is `pending`, set the pet back to `available` in both RPCs.
- **Confidence:** confirmed · **Source:** T3

### [P2] Removed pet photos stay public in Storage forever
- **Where:** `src/services/applications/pet-photo-service.ts:103-132`; `src/app/shelter/pets/PetPhotoManager.tsx:380-400`; there is no `storage.from('pet-photos').remove` anywhere in `src/`
- **Defect:** Removing a photo, deleting a pet, or a failed insert after upload deletes only the DB row, and the bucket is public-read.
- **Failure scenario:** A photo showing a foster's house number or face stays reachable at its URL after staff click Remove. Orphaned files also accumulate against the quota.
- **Fix:** Call `storage.remove` after the row is deleted and on the upload failure path, and add an orphan sweep.
- **Confidence:** confirmed · **Source:** T3

### [P2] Any user can set their own `user_profiles.is_admin`
- **Where:** migration `:907-909` ("Users update own profile" has no column limit); `src/services/admin/admin-auth-service.ts:19-27`; admin RPCs filter `is_admin = FALSE` (~`:1102, 1185, 1210, 1728`)
- **Defect:** Admin RPCs correctly check the JWT claim, but the UI gate reads this user-writable column, and the admin listings exclude anyone who has it set.
- **Failure scenario:** A user PATCHes `{is_admin:true}` on their own profile and disappears from the admin user list and stats (moderation evasion). They also see the `/admin` UI shell, though its data calls still fail.
- **Fix:** Revoke UPDATE on `is_admin` and `welcome_message_sent` from `authenticated` or pin them with a trigger, and have `checkIsAdmin` read `app_metadata`.
- **Also:** the `user_profiles` INSERT policy is `WITH CHECK (true)` (`:913-914`), and the client can flip `welcome_*_sent`. Drop the client INSERT policy, since a trigger creates profiles. No access-token hook syncs this column into the JWT (`supabase/config.toml:228` is commented out), which is why this is P2 rather than P0.
- **Confidence:** confirmed · **Source:** T3 + T1 + T5 (merged; also in the earlier diff-review pass)

### [P2] E2E "mutex" drops queued runs, so post-merge `main` E2E can be lost
- **Where:** `.github/workflows/e2e.yml:36-43` (`cancel-in-progress: false`)
- **Defect:** A concurrency group keeps at most one pending run, and a newer run cancels the older pending one. CLAUDE.md's "runs queue; they never race" overstates this.
- **Failure scenario:** PR A's E2E is running and the `main` push from PR B's merge is pending. A push to PR C cancels `main`'s run, so the merged commit never gets E2E.
- **Fix:** Give push and schedule runs their own group, or add a re-run safeguard, and correct the docs.
- **Confidence:** confirmed · **Source:** T7

### [P2] The post-merge rebrand command that CLAUDE.md requires does nothing
- **Where:** `scripts/rebrand.sh:63-65, 546-552`
- **Defect:** The script rebranded itself, so it now replaces "RescueDogs" with "RescueDogs" and contains no "ScriptHammer" string.
- **Failure scenario:** After `git merge upstream/main`, the rebrand reports "REBRAND COMPLETE", and upstream's ScriptHammer strings, theme names and URLs ship to raisedpaws.com.
- **Fix:** Parameterize the source name (`--from ScriptHammer`) or split the literal, and fail if any `ScriptHammer` reference remains afterwards.
- **Confidence:** confirmed · **Source:** T7

### [P2] `db:reset` has no production guard and wipes real adopters and applications
- **Where:** `scripts/reset-database.ts:26-37, 72-92, 250-287`; `package.json` `db:reset`
- **Defect:** There is one Supabase project, and the script deletes every `auth.users` row except the admin, which cascades to `adopter_profiles` and `applications`. The only guard is typing "RESET". It also paginates incorrectly (first 50 users only) and references the deleted `999_drop_all_tables.sql`.
- **Failure scenario:** A developer follows the usage line to reset test data and deletes real adopters and their applications.
- **Fix:** Refuse to run against the prod ref without an explicit flag, delete only test-domain users, and paginate.
- **Confidence:** confirmed (whether anyone runs it is plausible) · **Source:** T7

### [P2] Secret scanning skips silently and never runs in CI
- **Where:** `.husky/pre-commit:7-19, 55-65`; `.husky/pre-push:12-24`; `.gitleaks.toml` allowlist (`tests/.*`, `*.test.ts`, `*.spec.ts`); no gitleaks step in `.github/workflows/*`
- **Defect:** Without Docker or gitleaks (the Windows/Cursor flow), the hooks print "skipping" and pass. Nothing scans on the server, and the allowlist exempts exactly the files that handle the service-role key.
- **Failure scenario:** A collaborator hard-codes the service-role JWT in `tests/e2e/utils/*.ts` and pushes it unscanned.
- **Fix:** Add a required gitleaks CI job, make the hooks fail when gitleaks is missing, and narrow the allowlist to specific regexes.
- **Confidence:** confirmed · **Source:** T7

### [P2] `use:cloud` restores a stale `.env.cloud` and discards newer secrets
- **Where:** `scripts/switch-env.js:86-97, 106-115`
- **Defect:** The backup is written once, on the first `use:local`, and never refreshed, and `use:cloud` copies it over `.env` wholesale.
- **Failure scenario:** A token or rotated key added to `.env` while in cloud mode is permanently lost after the next local→cloud round trip.
- **Fix:** Refresh the backup whenever `.env` is in cloud mode, or overlay only the backend keys.
- **Confidence:** confirmed · **Source:** T7

### [P2] Auth E2E turns real failures into skips
- **Where:** `tests/e2e/auth/sign-up.spec.ts:99-105, 142-147, 162-168, 180-183`; `tests/e2e/auth/protected-routes.spec.ts:103-110, 286-290`
- **Defect:** Any sign-up error, any enforced captcha (always, in prod, #302), a failed test-user creation, or a missing session restore on *any* browser all become `test.skip`.
- **Failure scenario:** Sign-up breaks for everyone, or session rehydration breaks, and CI stays green with "skipped".
- **Fix:** Fail on unexpected errors, restrict the session skip to WebKit, and use a Turnstile test sitekey.
- **Confidence:** confirmed · **Source:** T8

### [P2] Rate-limiting spec passes whether or not lockout happens
- **Where:** `tests/e2e/auth/rate-limiting.spec.ts:85-91, 98-149, 173-195`
- **Defect:** It makes 6 attempts against a limit of 15, accepts "invalid credentials" as a pass, test 4 accepts either outcome, and the whole suite skips under captcha.
- **Failure scenario:** The rate limiter is removed entirely and all four tests still pass.
- **Fix:** Seed near-lockout as `brute-force.spec.ts` does, and assert the exact lockout copy, or its absence.
- **Confidence:** confirmed · **Source:** T8

### [P2] Group key rotation: excluding removed members is never tested
- **Where:** `tests/unit/services/messaging/group-key-service.test.ts:411-450` (`expect(true).toBe(true)` placeholders, a bare `rejects.toThrow()`); `src/services/messaging/__tests__/group-key-service.test.ts:399-423` (the mocked `.is` is never asserted)
- **Defect:** No test asserts forward secrecy.
- **Failure scenario:** Deleting `.is('left_at', null)` from `rotateGroupKey` (`group-key-service.ts:537`) sends new keys to removed members, and the suite stays green.
- **Fix:** Assert the filter call, and pass in a removed member to assert that no key is encrypted for them. Delete the placeholders.
- **Confidence:** confirmed · **Source:** T8

### [P2] Messaging E2E has swallowed or missing assertions
- **Where:** `tests/e2e/messaging/real-time-delivery.spec.ts:197-202` (`expect` in try/catch), `:208-232` (no assertion), `:285-305` (fixed 6-second sleep, then checks only that the input is visible); `tests/e2e/messaging/encrypted-messaging.spec.ts:271-315` (10 messages against a 50-message page, so Load More never runs)
- **Defect:** The typing indicator and pagination can break without any test failing.
- **Failure scenario:** Typing-indicator or Load More regressions ship green, and about 12 seconds of fixed sleeps are added to every run.
- **Fix:** Use `expect.poll`/`toBeHidden({timeout})`, and seed more than 50 messages to assert Load More unconditionally.
- **Confidence:** confirmed · **Source:** T8

### [P2] Admin E2E specs are hard-skipped in CI
- **Where:** `tests/e2e/admin/admin-dashboard.spec.ts:38`, `admin-user-pagination.spec.ts:36`, `admin-conversation-list.spec.ts:50`; `vitest.config.ts:64` excludes `tests/contract/admin/admin-access.contract.test.ts`
- **Defect:** Nothing automated exercises the admin surface or its RPC gate.
- **Failure scenario:** The admin RPC gate regresses and a non-admin can list users, with nothing in CI to catch it.
- **Fix:** Run these in the local-Supabase CI job proposed for the RLS suite.
- **Confidence:** confirmed · **Source:** T8

### [P2] Theme state in GlobalNav and ThemeSwitcher drifts apart; the nav ignores cookie consent
- **Where:** `src/components/GlobalNav.tsx:322-356`; `src/components/theme/ThemeSwitcher.tsx:18-76`; `src/components/ThemeScript.tsx:366-378`
- **Defect:** Both components read the theme once and never subscribe to changes. The nav writes `localStorage.theme` without checking `canUseCookies(FUNCTIONAL)`.
- **Failure scenario:** The user picks dark on `/themes`, the nav toggle still thinks the theme is light, and the first click does nothing. A user who declined functional cookies still gets their theme persisted.
- **Fix:** Use one theme context that subscribes to `themechange`/`storage`, with a single setter that checks consent.
- **Confidence:** confirmed · **Source:** T6

### [P2] Ticking timers re-announce every second; the idle modal isn't a dialog
- **Where:** `src/components/atomic/CountdownBanner/CountdownBanner.tsx:90-103` (site-wide via `app/layout.tsx:186`); `src/components/molecular/IdleTimeoutModal/IdleTimeoutModal.tsx:32-45`
- **Defect:** `aria-live="polite"` is set on text that changes every second. The idle warning has no `role="dialog"`/`aria-modal` and never moves focus.
- **Failure scenario:** From Oct 31, screen readers announce the countdown every second on every page. Keyboard and screen-reader users can be signed out without ever reaching Continue.
- **Fix:** Announce only at thresholds, and render the idle warning as a `<dialog>` opened with `showModal()` with Continue focused.
- **Confidence:** confirmed · **Source:** T6

### [P2] Site-wide countdown banner sells "$543.21/yr Custom Raised Paws Setup" from Oct 31
- **Where:** `src/components/atomic/CountdownBanner/CountdownBanner.tsx:9-17, 110`; mounted in `src/app/layout.tsx:186`
- **Defect:** This is ScriptHammer's template sales promo, rebranded but never removed. `SEASON_PRICES` and the "Custom … Setup" copy have nothing to do with a rescue site.
- **Failure scenario:** Starting 2026-10-31, every page on raisedpaws.com shows a paid-setup countdown to adopters and shelters.
- **Fix:** Remove the banner from the layout (or delete the component), and add it to the post-merge rebrand checklist.
- **Confidence:** confirmed · **Source:** T6 lead, verified by the orchestrator

### [P2] GeolocationConsent pre-ticks analytics and personalization; the dialog never takes focus
- **Where:** `src/components/map/GeolocationConsent/GeolocationConsent.tsx:40-52, 74-88`; used at `src/app/map/page.tsx:214`
- **Defect:** Every purpose starts checked, which isn't valid GDPR consent. The Escape handler works only when focus is already inside the dialog, and there's no focus trap.
- **Failure scenario:** Clicking "Accept" to see one's location records consent to analytics and personalization. Keyboard users stay on the page behind the dialog.
- **Fix:** Default to only `USER_LOCATION_DISPLAY`, and use `<dialog>` with `showModal()`.
- **Confidence:** confirmed · **Source:** T6

### [P2] AccountDeletionModal can be closed with Escape mid-delete, leaving the parent out of sync
- **Where:** `src/components/molecular/AccountDeletionModal/AccountDeletionModal.tsx:40-46, 79-91`
- **Defect:** There's no `onCancel` handler, so Escape closes the native dialog while `isDeleting` is true, but the parent's `isOpen` stays true.
- **Failure scenario:** A delete error lands in a closed dialog, and the modal can't be reopened until a remount.
- **Fix:** Call `preventDefault` in `onCancel` while deleting, and sync the parent from the dialog's close event.
- **Confidence:** confirmed · **Source:** T6 + T5 (merged; T5 graded P3)

### [P2] `add_shelter_staff_by_email` reveals which emails have accounts and adds staff without consent
- **Where:** migration `:3514-3582` (distinct `user_not_found`/`user_not_confirmed` results; inserts with no invite step); `:3290` (`already_a_member`); `shelter_members` has only a SELECT policy (`:4032`); `is_shelter_staff(p_shelter, check_user_id)` `:3139-3152` is callable by anon
- **Defect:** Anyone can become a manager through `create_my_shelter`. From there they can probe emails and silently attach real people as staff, and the target has no way to leave.
- **Failure scenario:** An attacker learns which emails are registered. Adding a real rescue's email to the attacker's shelter means that rescue's own `create_my_shelter` fails with `already_a_member` forever. Anon can also test staff membership for any user id.
- **Fix:** Use an invite/accept flow with one generic result, add a self-leave RPC, and REVOKE `is_shelter_staff` from anon/PUBLIC (or drop the `check_user_id` parameter).
- **Confidence:** confirmed · **Source:** T1 + T3 (merged; also in the earlier diff-review pass)
- **Severity note:** Raised from P3 (T3) to T1's P2. The consent-less add can permanently block a real rescue from onboarding.

### [P2] PayPal one-time payments are recorded twice, and the captured row has no amount
- **Where:** `supabase/functions/create-paypal-order/index.ts:189-198`; `capture-paypal-order/index.ts:166-174`; `paypal-webhook/index.ts` `handlePaymentCompleted`
- **Defect:** Capture flips the order row to succeeded without `charged_amount`. The webhook then inserts a second succeeded row keyed by capture id.
- **Failure scenario:** One $20 payment shows as 2 successful payments in admin stats and payment history, and one of them has a NULL amount.
- **Fix:** Upsert by `intent_id`/order id in the webhook, and store `charged_amount` on capture.
- **Confidence:** confirmed · **Source:** T1

### [P2] Submitted form drafts come back after a fast submit
- **Where:** `src/hooks/useFormDraft.ts:104-114, 150-168, 286-311`; callers `src/app/adopt/page.tsx:124-125`, `src/app/shelter/pets/new/page.tsx:178`, `src/app/shelter/pets/edit/page.tsx:218`; `src/components/forms/ApplicationForm/ApplicationForm.tsx:250-256`
- **Defect:** `clearDraft()` doesn't reset `pending.current`, and the external `clearFormDraft()` can't cancel the hook's timer. The unmount flush triggered by `router.push` writes the draft back.
- **Failure scenario:** Submitting within the 800ms debounce brings the draft back. The next Add Pet auto-restores the previous pet, leading to duplicate listings. The next `/adopt` visit restores the full application (address, phone, vet), and resubmitting hits 23505.
- **Fix:** Null `pending.current` in `clearDraft`, add a module-level cancelled-keys set that the timer and flush check, and test clear-then-unmount.
- **Confidence:** confirmed (the frequency depends on timing) · **Source:** T4 + T5 (merged)

### [P2] Content-Security-Policy is emitted as an inert `<meta name>`
- **Where:** `src/app/layout.tsx:140-160` (`metadata.other['Content-Security-Policy']`, plus `Cache-Control`/`Pragma`/`Expires`)
- **Defect:** Next renders these as `<meta name=…>`. Browsers honour CSP only from `http-equiv` or a response header, and nothing in `src/` emits `httpEquiv`. `docs/project/SECURITY.md:72-76` claims a strict CSP.
- **Failure scenario:** There's no CSP behind the `dangerouslySetInnerHTML` sinks (`BlogContent.tsx:73`, including an inline `onclick`, and `CodeBlock.tsx:79`), and any third-party script, such as Disqus, loads unrestricted.
- **Fix:** Render `<meta httpEquiv="Content-Security-Policy" …>` in the root `<head>` after auditing the allow-list, and add a test that checks the rendered tag.
- **Confidence:** confirmed (T4; T5 rated it plausible) · **Source:** T4 + T5 (merged)

### [P2] Disqus loads without cookie consent and falls back to the wrong domain
- **Where:** `src/components/molecular/DisqusComments.tsx:70-72, 236-250`; `src/app/blog/[slug]/page.tsx:155, 188-194`; shortname in `src/config/author-generated.ts:22`
- **Defect:** `embed.js` is injected on scroll with no `useConsent()` check, unlike `CalendarEmbed` (`CalendarEmbed.tsx:67`). The fallback URL is hard-coded to `https://rescuedogs.com/blog/…` rather than raisedpaws.com.
- **Failure scenario:** A visitor who rejected non-essential cookies scrolls a post, and Disqus sets tracking cookies anyway. If `NEXT_PUBLIC_BASE_URL` is unset, threads attach to the wrong domain.
- **Fix:** Gate the script on consent behind a "load comments" placeholder, and derive the fallback from CNAME or config.
- **Confidence:** confirmed (consent); plausible (domain, depending on env) · **Source:** T5 + T6 (merged)

### [P2] "Remember Me" does nothing — sessions always persist
- **Where:** `src/components/auth/SignInForm/SignInForm.tsx:53, 345-360`; `SignUpForm.tsx:45, 252`; `src/lib/supabase/client.ts:185` (`persistSession: true`)
- **Defect:** The `rememberMe` state is never read.
- **Failure scenario:** On a shared shelter or library computer, the next person opens the site already signed in, with access to applications, home address and messages.
- **Fix:** Use sessionStorage-backed auth storage when the box is unchecked, or remove the checkbox.
- **Confidence:** confirmed · **Source:** T5

### [P2] A rate-limit infrastructure error is shown as "account locked"
- **Where:** `src/lib/auth/rate-limit-check.ts:110-141`; `SignInForm.tsx:83-101`; `ForgotPasswordForm.tsx:52-62`; `SignUpForm.tsx:81-91`
- **Defect:** `checkRateLimit` fails closed with a `reason`, but all three forms ignore the reason and show the lockout copy. The "fail-open" try/catch is dead code.
- **Failure scenario:** When Supabase is paused or cold (a known free-tier state), every user is told their account is locked for 15 minutes.
- **Fix:** Show `reason` when `locked_until` is null, and correct the dead comment.
- **Confidence:** confirmed · **Source:** T5

### [P2] Auth callback's stale timer bounces a signed-in user to the sign-in page
- **Where:** `src/app/auth/callback/page.tsx:74-80`
- **Defect:** The 2-second `setTimeout` captures `user=null` and is never cleared.
- **Failure scenario:** The session arrives after loading clears (the 10-second timeout, or the transient SIGNED_OUT noted at `AuthContext:285-289`). The page pushes `/profile`, then 2 seconds later `/sign-in?error=auth_callback_failed`.
- **Fix:** Return `clearTimeout` from the effect, or read `user` from a ref.
- **Confidence:** plausible (the defect is confirmed; the frequency is timing-dependent) · **Source:** T4

### [P2] Payment result "still processing" never updates, and hides not-found/forbidden
- **Where:** `src/app/payment-result/page.tsx:36-89, 210-233`
- **Defect:** The page promises to "update automatically", but nothing polls or subscribes. A missing intent and another user's intent (hidden by RLS) look the same.
- **Failure scenario:** If the redirect beats the webhook, the user sits on "processing" forever and may pay again.
- **Fix:** Poll with backoff or subscribe to `payment_results`, and query `payment_intents` to tell the cases apart.
- **Confidence:** confirmed · **Source:** T4

## P3

### [P3] Email service retries non-idempotent sends
- **Where:** `src/utils/email/email-service.ts:149-178`; `supabase/functions/contact-message/index.ts:186-199`
- **Defect / failure:** 4xx, 429 and 502 responses are retried blindly and fail over to another provider. Each retry uses up a rate-limit slot, and a response lost after the send succeeded produces duplicate emails.
- **Fix:** Don't retry 4xx or 429, and send Resend's `Idempotency-Key` header.
- **Confidence:** confirmed · **Source:** T3

### [P3] Timeout wrapper doesn't cancel the insert, so a retry can create duplicate pets
- **Where:** `src/lib/with-timeout.ts:4-26`; `src/app/shelter/pets/new/page.tsx:142-156`
- **Defect / failure:** On a slow connection the insert succeeds after the UI has shown a timeout, and the retry creates a second listing.
- **Fix:** Pass an `AbortSignal`, or generate the id on the client and upsert.
- **Confidence:** plausible · **Source:** T3

### [P3] `monitor.yml` probes the old github.io URL, and none of its checks can fail
- **Where:** `.github/workflows/monitor.yml:13, 18-19, 36-44, 172-199`
- **Defect / failure:** The probe gets a 301 to raisedpaws.com (no `curl -L`), burns 5 minutes, and only warns. raisedpaws.com can be down and Monitor still reports success. It also has an unused `contents: write` permission and runs a non-frozen install.
- **Fix:** Probe `vars.NEXT_PUBLIC_DEPLOY_URL` with `curl -L`, exit 1 on non-200, and drop the write permission.
- **Confidence:** confirmed · **Source:** T7

### [P3] `build` and `test` always wipe `.next`, breaking the running dev server on every push
- **Where:** `package.json:42, 45, 59`; `scripts/validate-ci.sh:68-72, 84-92`; `.husky/pre-push`
- **Defect / failure:** `clean:next` ignores `NEXT_DIST_DIR`, so every pre-push test run empties the dev server's `.next`.
- **Fix:** Target `${NEXT_DIST_DIR:-.next}` and drop the clean from `test`.
- **Confidence:** plausible · **Source:** T7

### [P3] Docker E2E compose can never come up healthy
- **Where:** `docker/docker-compose.e2e.yml:20, 41`; `scripts/run-e2e-tests.sh:81-91`
- **Defect / failure:** It uses a stale `/RescueDogs` basePath and loads no `.env`, so the healthcheck 404s and global-setup aborts.
- **Fix:** Use root paths and add `env_file`, or delete the `--docker` path.
- **Confidence:** confirmed · **Source:** T7

### [P3] RLS stale-user cleanup misses the application suite's users
- **Where:** `tests/rls/__setup__/cleanup-stale-impl.ts:16, 57-60`; `tests/rls/application-rls.test.ts:48-58, 261-272, 385-392`
- **Defect / failure:** The suite's `@example.com` users aren't swept, and the lookup in `listUsers({perPage:1000})` doesn't paginate. After a killed run, the next run throws "Failed to recreate".
- **Fix:** Use the `@rescuedogs.test` domain and paginate.
- **Confidence:** plausible · **Source:** T8

### [P3] AvatarDisplay never clears its image-error flag when the URL changes
- **Where:** `src/components/atomic/AvatarDisplay/AvatarDisplay.tsx:35, 68, 82`
- **Defect / failure:** After one failed load, the nav keeps showing initials even after a new avatar is uploaded, until a reload.
- **Fix:** Reset the flag on URL change, or key the `<img>` on the URL.
- **Confidence:** confirmed · **Source:** T6

### [P3] RoleDropdown's `aria-expanded` is inverted after a mouse click
- **Where:** `src/components/GlobalNav.tsx:128, 144`
- **Defect / failure:** The focus handler opens the menu, then the click handler toggles it closed, while CSS `:focus-within` still shows it. Screen readers hear "collapsed".
- **Fix:** Drive visibility from `open`, and drop the focus-triggered opener.
- **Confidence:** confirmed code path (not browser-verified) · **Source:** T6

### [P3] Dev only: A11yDevOverlay rescans in a loop; DataExportButton gets stuck under StrictMode
- **Where:** `src/components/organisms/A11yDevOverlay/useA11yScan.ts:98-107`, `A11yDevOverlay.tsx:199-203`; `src/components/atomic/DataExportButton/DataExportButton.tsx:29-35, 72-75`
- **Defect / failure:** The overlay's own DOM mutations trigger rescans about every 0.5 seconds. The button's `mountedRef` is never reset to true, so it stays on "Exporting…".
- **Fix:** Ignore mutations inside the overlay, and set `mountedRef.current = true` in the effect.
- **Confidence:** confirmed (dev only) · **Source:** T6

### [P3] Pet edit copy uses unsaved form state and a different sex fallback than the save
- **Where:** `src/app/shelter/pets/edit/page.tsx:193` (`sex || pet.sex`) vs `:209` (`sex || null`); `:477-481` (`petArchiveNote` gets the unsaved `status`/`name`)
- **Defect / failure:** Picking Adopted immediately says the pet is "hidden from browse" before any save, and after navigating away the pet is still listed. Clearing sex still produces "Marking him adopted…" while the save writes null.
- **Fix:** Pass `pet.status`/`pet.name`, and use `sex || null` in the confirm copy.
- **Confidence:** confirmed · **Source:** T4 (also in the earlier diff-review pass)

### [P3] Sign-in, sign-up and get-started double-decode `returnUrl`; a `%` crashes the page
- **Where:** `src/app/sign-in/page.tsx:53-58`; `src/app/sign-up/page.tsx:34-36`; `src/app/get-started/page.tsx:52-66`
- **Defect / failure:** `/sign-in?returnUrl=%2525` throws a URIError, and the ErrorBoundary replaces the sign-in page. It isn't an open redirect: `isSafeRedirectUrl` holds.
- **Fix:** Drop the second decode and share one validator.
- **Confidence:** confirmed · **Source:** T4

### [P3] Analytics events keep firing after consent is withdrawn
- **Where:** `src/utils/analytics.ts:139-145`; `src/utils/error-handler.ts:235`; `src/utils/web-vitals.ts:57-58`
- **Defect / failure:** `isAnalyticsEnabled` checks only that `gtag` exists, so unscrubbed error messages and web vitals still go to GA after the user revokes consent.
- **Fix:** Gate on `canUseCookies(ANALYTICS)` and run `scrubString` on error text.
- **Confidence:** confirmed · **Source:** T4

### [P3] Shelter application page shows "not found" when the load actually failed
- **Where:** `src/app/shelter/application/page.tsx:44-46, 133-139`
- **Defect / failure:** A network blip or paused Supabase tells staff the application was removed.
- **Fix:** Render the error with a retry button when `error && !application`.
- **Confidence:** confirmed · **Source:** T4

### [P3] StatusDropdown discards the staff note when the status change fails
- **Where:** `src/components/molecular/StatusDropdown/StatusDropdown.tsx:69-78`
- **Defect / failure:** `finally` clears the note even when `onAdvance` rejects, so a long rejection note is lost on a network or RLS error.
- **Fix:** Reset only on success.
- **Confidence:** confirmed · **Source:** T5

### [P3] SignInForm re-enables submit mid-flight and runs stale password key derivation
- **Where:** `src/components/auth/SignInForm/SignInForm.tsx:115, 188-285`; `src/services/messaging/key-service.ts:43, 247`
- **Defect / failure:** `setLoading(false)` runs before the post-auth key work, so a double click can insert two active keys. Since device keys (#60), `deriveKeys` calls `atob()` on the `'rp-device-key-v1'` marker and logs a failure after a wasted PBKDF2 pass on every sign-in.
- **Fix:** Keep `loading` true through the whole handler, and drop the password-derivation block in favour of `ensureKeysForSession`.
- **Confidence:** confirmed (the error on every sign-in); plausible (the double-key race) · **Source:** T5
