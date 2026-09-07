# Supabase Realtime usage — investigation and recommendation

**Issue:** [#224](https://github.com/TortoiseWolfe/RescueDogs/issues/224) · **Deadline:** dashboard says projects are **restricted from 18 Sep 2026**; the fair-use email cited 2026-09-19. Plan against the earlier date. · **Status:** investigation superseded by §10 — the fixes landed and were measured on 2026-09-07. Read §10 first; §§1-9 are the August reasoning, corrected in place where it was wrong.

Supabase's fair-use notice reports org **Tech by Schlajo** at **2,296,215** Realtime messages against a ~2.2M Free-plan quota — **96,215 over, 4.4%**. One-time grace for this billing period.

---

## 1. What Supabase actually bills

Realtime messages are **deliveries**, not row changes:

```
billed ≈ (row changes on published tables) × (clients subscribed to that table)
```

So there are two independent levers — how many rows change, and how many clients each change is fanned out to. **The second one is where this repo's problem lives.** A single unfiltered subscription turns one write into one delivery _per connected client_.

Reference: [Realtime messages usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages).

---

## 2. What we could not measure, and why

> **Resolved 2026-09-07.** `SUPABASE_ACCESS_TOKEN` is now present in local `.env`, so the Management API checks below are done and recorded in §10. @schlajo supplied the dashboard figures. The section is kept because it is what made §5's arithmetic an estimate rather than a measurement.

**We do not have access to the Usage dashboard.** Recorded plainly so the numbers below are read as what they are — derived estimates, not measurements:

- The Supabase MCP available here authenticates to `spoketowork@gmail.com's Org` (one, inactive project). The RescueDogs project `cmdhajshektesctrappl` belongs to **Tech by Schlajo** and is not reachable from it.
- Local `.env` carries only `NEXT_PUBLIC_SUPABASE_URL` and the anon key. **`SUPABASE_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are both absent** — this is [#6](https://github.com/TortoiseWolfe/RescueDogs/issues/6), still open.

### What only @schlajo can supply

| Needed                                                                      | Where                        |
| --------------------------------------------------------------------------- | ---------------------------- |
| Realtime **messages** for the billing period                                | Dashboard → Usage → Realtime |
| Realtime **peak connections**                                               | same panel                   |
| `SELECT COUNT(*) FROM messages;` and growth rate                            | SQL editor                   |
| Whether any signed-in production sessions were open during heavy CI windows | judgement call               |

**Peak connections is the single most valuable number**, because §5 shows the CI estimate accounts for only ~4% of the billed total. Something else produces the other ~2.2M, and connection count is what will identify it.

---

## 3. The publication — 9 tables, all `REPLICA IDENTITY FULL`

`supabase/migrations/20251006_complete_monolithic_setup.sql`, two blocks (2519-2576, 3113-3128):

`conversations` · `conversation_members` · `messages` · `typing_indicators` · `user_connections` · `payment_results` · `subscriptions` · `applications` · `application_status_history`

Three things worth acting on:

- **`typing_indicators` is published but has no reader and no writer.** No `.from('typing_indicators')` anywhere in `src/`; typing is broadcast-only. Pure dead weight in the publication.
- **`REPLICA IDENTITY FULL` on every published table** (2513-2517, 3110-3111) makes every UPDATE/DELETE carry the whole old row _plus_ the new one. On `messages`, which holds encrypted ciphertext, that is the largest per-event byte multiplier in the schema. (`payment_results` and `subscriptions` inconsistently lack it.)
- **No RLS-based Realtime authorization at all** — no `realtime.messages` policies, no private channels, no `setAuth()`. Everything is the legacy public `postgres_changes` path, where the server evaluates every subscriber's RLS against every changed row.

---

## 4. The fan-out — 5 of 7 subscriptions are table-wide

| Site                                                  | Table(s) / event                                           | Filter       | Mounts on                                          |
| ----------------------------------------------------- | ---------------------------------------------------------- | ------------ | -------------------------------------------------- |
| `src/hooks/useUnreadCount.ts:64-84`                   | `messages` `*`                                             | **none**     | **every route** — `GlobalNav` via `layout.tsx:179` |
| `.../ConversationList/useConversationList.ts:370-400` | `conversations` `*` + `conversation_members` `*`           | **none**     | `/messages`                                        |
| `src/hooks/useConnections.ts:114-131`                 | `user_connections` `*`                                     | **none**     | `/messages?tab=connections`                        |
| `src/hooks/usePaymentResultsRealtime.ts:43-64`        | `payment_results` `*`                                      | **none**     | `/payment`, `/payment-demo` — **guests included**  |
| `src/hooks/useSubscriptionsRealtime.ts:30-51`         | `subscriptions` `*`                                        | **none**     | `/payment?tab=subscriptions`                       |
| `src/hooks/useApplicationRealtime.ts:89-131`          | `applications` UPDATE, `application_status_history` INSERT | `id=eq.…` ✅ | `/applications/status`                             |
| `src/hooks/usePaymentRealtime.ts:83-102`              | `payment_results` `*`                                      | `id=eq.…` ✅ | `/payment-result`                                  |

### `useUnreadCount` is the worst offender

The channel _name_ is per-user (`unread-messages-${user.id}`) but the **binding is table-wide**, and the conversation check runs **client-side after delivery**:

```ts
{ event: '*', schema: 'public', table: 'messages' },   // no filter
(payload) => {
  const conversationId = payload.new?.conversation_id || payload.old?.conversation_id;
  if (conversationId && conversationIdsRef.current.includes(conversationId)) {
    fetchUnreadCount();
  }
}
```

Every message in the entire table is billed, delivered, then thrown away. And because `GlobalNav` renders in the root layout, **every signed-in user holds this binding on every page of the site** — not just `/messages`.

The sibling file already knows this is wrong. `useConversationList.ts:365-367` documents removing a `messages` binding precisely because _"those fire for ALL users globally."_ The same anti-pattern was left in place one file over.

All 7 sites unsubscribe correctly — there is **no leak**. But `useUnreadCount`'s effect is keyed on the `user` object identity, and `AuthContext.tsx:261` replaces that object on every auth event including `TOKEN_REFRESHED`, so the channel is torn down and re-created roughly hourly per session. That is resubscribe churn, not accumulation.

**Upstream ScriptHammer has the identical unfiltered binding.** Any fix here is worth sending upstream.

---

## 5. Server-side amplifiers

### One message send is three published row changes, and one of them is redundant

1. `messages` INSERT — `src/services/messaging/message-service.ts:400`
2. `conversations` UPDATE — DB trigger `on_message_inserted` (migration 2076-2087)
3. `conversations` UPDATE — **again**, explicitly from the client at `message-service.ts:488`

Steps 2 and 3 do the same thing. The trigger already sets `last_message_at`; the client then sets it a second time. **Deleting the client-side update removes a third of the send-path fan-out with no behaviour change** — and because `useConversationList` subscribes to `conversations` unfiltered, each of those redundant UPDATEs is delivered to _every_ user sitting on `/messages`.

Same shape elsewhere: one `applications` INSERT also writes `application_status_history` (trigger, 2956-2975), and `advance_application_status()` (2791-2870) does UPDATE + INSERT per staff action.

---

## 6. CI volume — measured, and smaller than expected

E2E runs against the **cloud** project (`e2e.yml:51-52`; `SUPABASE_ADMIN_URL` is never set in CI, so every admin client falls through to the public cloud URL). From Actions history, 2026-07-22 → 2026-08-20:

| Event        | Runs | Shards | Messaging passes |
| ------------ | ---- | ------ | ---------------- |
| push → main  | 64   | 24     | 3 browsers       |
| weekly cron  | 4    | 24     | 3 browsers       |
| pull request | 89   | 8      | chromium only    |

Weekly volume peaked at 45 runs (W30) and is trending down (21 in W34).

### Raw writes vs billed messages — the distinction that matters

The messaging suite performs **~4,974 publication row-changes per browser per pass**. But **91% of that is `performance.spec.ts`**, which re-seeds 150 messages in three separate `beforeEach` hooks across 10 tests (≈4,530 writes). Those seeds happen **before a browser context is opened**, and the teardown deletes happen **after it closes** — so they have **zero subscribers** and produce almost no _billed_ messages. They are real database and WAL load, but not Realtime spend.

The genuinely billed traffic is the ~54 real sends:

```
54 sends × 3 row-changes × ~2 subscribed contexts ≈  324  per browser
                              main/cron run (×3)  ≈  972
                              PR run (×1)         ≈  324

68 main+cron × 972  =  66,096
89 PR        × 324  =  28,836
                       -------
CI estimate         ≈  94,932  per billing period
```

**That is ~4% of the 2,296,215 billed — and almost exactly the 96,215 overage.**

Two honest readings follow, and they point the same way:

- **Removing CI from the shared project plausibly erases the entire overage** and puts them back under quota.
- **It does not explain the other ~2.2M.** Something else is the baseline. Until the dashboard numbers arrive, the leading candidate is persistent connections — every signed-in tab holds the table-wide `messages` binding, and Supabase counts channel joins and heartbeats, not only data deliveries. Local developer runs are a second candidate: `pnpm test:e2e` also targets the cloud project, and locally the `Mobile - *` / `Tablet - *` projects **do not** exclude `**/messaging/**`, so a bare local run re-seeds the whole messaging suite once per viewport.

Retries widen the band: `playwright.config.ts:82` sets `retries: 2` in CI, so a failing test re-runs its `beforeEach` seeds up to three times.

---

## 7. A finding that outlives this ticket

**`cleanupOldMessages` is dead code.** It is defined at `tests/e2e/utils/test-user-factory.ts:1107` and referenced 17 times — _every reference outside the definition is a comment saying the spec no longer calls it_. #116 Phase 2 removed all invocations.

The repo-wide E2E mutex still cites it as its justification (`e2e.yml:36-41`):

> every E2E run shares one Supabase project, and concurrent runs race each other's `beforeAll` cleanupOldMessages hooks

**That hazard no longer exists.** The mutex serializes every E2E run in the repository — the same mutex that has been starving the CI queue for hours at a time (see [#210](https://github.com/TortoiseWolfe/RescueDogs/issues/210), [#214](https://github.com/TortoiseWolfe/RescueDogs/issues/214)).

> ### ⚠️ Correction (2026-09-07): do NOT drop the mutex. Its _justification_ is stale; its _necessity_ is not.
>
> This section originally concluded that moving CI off the shared project "removes its remaining rationale entirely". That is wrong, and acting on it would break CI.
>
> `cleanupOldMessages` is indeed dead code. But another `beforeAll` performs a globally destructive write: **`clearAllRateLimits()`** (`tests/e2e/utils/rate-limit-admin.ts:47-50`) deletes **every row** of `rate_limit_attempts`, and `tests/e2e/security/brute-force.spec.ts:51-61` depends on the near-lockout rows it seeded surviving until its assertion. Two concurrent runs against one project: run 2's `beforeAll` wipes run 1's state and fails it. That is exactly the class of race the mutex was written for, and it outlives `cleanupOldMessages`.
>
> Fix that first (it is the same shared-project root cause), then reconsider the mutex.

---

## 8. Recommendation

### Primary — move CI E2E off the shared cloud project

**The local Supabase stack already exists in this repo.** It was built in #121/#122 (2026-06-03) and never adopted for CI:

- `docker compose --profile supabase` brings up db, kong, auth, rest, realtime, storage, meta, studio, mailpit
- `pnpm use:local` / `pnpm dev:local` switch env and seed; `.env.local-supabase` is committed
- the monolithic migration is applied automatically on first boot, via a deliberate single-file mount whose comment documents the two bugs that made a directory mount fail
- `playwright.config.ts` only sets `baseURL` — the Supabase URL is pure env, so redirecting E2E is an env swap plus a compose step

**One gap blocks it.** Realtime resolves its tenant from the _first label of the Host header_, and `docker/supabase/kong.yml:125,142` points at `http://supabase-realtime:4000` — a single-label host with no tenant, so the socket can never join. Upstream ScriptHammer fixed exactly this in **#649**: `realtime-dev.supabase-realtime` as both the Kong upstream and the `container_name`, plus a `command:` that runs the Ecto migrations and seeds the tenant. Our `kong.yml` has not changed since March.

> ### Correction (2026-09-07): this said "**it is a two-file cherry-pick**". That was wrong by roughly an order of magnitude.
>
> The diagnosis holds — `kong.yml:125,142` is exact and the tenant mechanism is real. The **cost estimate** does not:
>
> - **Three bugs, not one.** Upstream's `15f18aae` also fixes an **anon-key/JWT-secret mismatch**, and this repo has it: `docker-compose.yml:264` (realtime healthcheck) and `:338` (studio) carry a key signed by a different secret than `x-supabase-env` at `:23`. Fix the Host label and the Ecto `command:` and the container still reports `unhealthy` forever. `.env.example:46-47` documents the wrong pair too, disagreeing with `.env.local-supabase:27-28`.
> - **It will not `git cherry-pick`.** Upstream renamed the vars to `SUPABASE_LOCAL_ANON_KEY` / `SUPABASE_LOCAL_SERVICE_ROLE_KEY`; this repo still uses `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. It is a hand-port.
> - **"An env swap plus a compose step" is the real miss.** The env plumbing genuinely is as described — `switch-env.js`, `SUPABASE_ADMIN_URL`, `playwright.config.ts:100`. But `e2e.yml` is built around **one** build artifact (`NEXT_PUBLIC_SUPABASE_URL` is baked at build time) and **one** shared `auth-state` artifact handed to 24 shards. Per-runner databases invalidate both.
> - **The empirical answer:** upstream needed a separate **777-line `e2e-local.yml`** across **ten commits** (#586 → #894), including a schema-fidelity gate and parity tooling built precisely because 24 jobs once went green while firefox and webkit executed zero tests. And having done all of that, upstream **still runs its own `e2e.yml` against its cloud project today**.
>
> Realistic cost: Phase A (make the stack boot: `docker-compose.yml`, `kong.yml`, `.env.example`) ~½–1 day. Phase B (make the existing suite pass — edge runtime, Kong `functions-v1` route, demo seeds for `anti-ghosting.spec.ts`, non-`@example.com` test emails) 2–4 days. **Phase C (CI) 1–2 weeks.** Phases A and B are worth doing on their own merits — the local dev stack has been broken since March — but this is **not** a deadline fix.

Effect if fully done: CI's Realtime contribution → **zero**. (This originally also claimed it retires the §7 mutex — see the correction there; a second destructive `beforeAll` keeps the mutex necessary until it is fixed.)

One hazard to plan for: `container_name` is **global**, not namespaced by `COMPOSE_PROJECT_NAME`. A local RescueDogs stack would collide with a running ScriptHammer one. Harmless in CI, which is isolated per runner.

### Secondary — scope the unfiltered subscriptions

Independently valuable, because it cuts **production** fan-out rather than CI, and upstream shares every one of these bugs:

1. **`useUnreadCount`** — filter server-side, subscribe only on `/messages`, or drop the badge. Biggest single win.
2. **Delete the redundant `conversations` UPDATE** at `message-service.ts:488`. Free — the trigger already does it.
3. **Remove `typing_indicators` from the publication.** No reader, no writer.
4. **`conversations` / `conversation_members`** — scope to the user's own conversations.
5. Consider narrowing `REPLICA IDENTITY FULL` on `messages`, but verify nothing reads `payload.old` first.

### Fallback — dedicated CI Supabase project (ticket option A)

If the local stack proves unstable in CI. Needs the migration and seeds kept in sync, but it is simple and well understood.

> ### Correction (2026-09-07): a second project in the **same org** does not help.
>
> **Supabase bills at the organization level, not per project.** Both Usage screenshots read _"Organization is on the Free Plan"_ with an _"All projects"_ selector, and the figures aggregate every project in `Tech by Schlajo`. A second project there moves CI's usage between projects inside one shared quota pool and changes the bill by nothing.
>
> For this option to do what the ticket intends, the CI project must live in a **different organization**.
>
> **And that is currently blocked.** `ACCOUNTS.md` (workspace root, verified 2026-09-07 by live API call) states the binding rule, with Supabase's own refusal text quoted: the free limit is **2 ACTIVE projects per USER**, counted across every org where that user is Owner or Administrator — _not_ per org. _"Spreading across orgs does not raise it."_
>
> | account                  | owned-active           | headroom         |
> | ------------------------ | ---------------------- | ---------------- |
> | `spoketowork@gmail.com`  | 2 (SpokeToWork, runit) | **0 — at limit** |
> | `jonpohlner@gmail.com`   | 1 (geoLARP)            | 1                |
> | `waynepohlner@gmail.com` | 1 (ScriptHammer)       | 1                |
>
> So the real options are: use one of the other two accounts' single slot (against the file's own placement principle — a project belongs to the account matching its domain), or relocate `runit`, which `ACCOUNTS.md` names as _"the remaining thing standing between `spoketowork@gmail.com` and any headroom."_
>
> **Read `ACCOUNTS.md` before reasoning about this option again.** Two Supabase orgs are named `ScriptHammer` and two are named `geoLARP`, on different accounts — always disambiguate by org id.

### Rejected — Pro plan (ticket option D)

At 4.4% over, $25/month treats a symptom. Revisit only if §2's dashboard numbers show the ~2.2M baseline is legitimate product traffic rather than fan-out.

### Upstream (ticket option E)

Send items 1-3 to ScriptHammer. The unfiltered `useUnreadCount` binding is byte-identical there.

---

## 9. Sequencing against the 18 Sep 2026 restriction date

| Order | Action                                    | Effort             | Est. reduction                 |
| ----- | ----------------------------------------- | ------------------ | ------------------------------ |
| 1     | Get the dashboard numbers (§2)            | @schlajo, minutes  | — attributes the missing ~2.2M |
| 2     | Delete redundant `conversations` UPDATE   | one line           | ~⅓ of send-path fan-out        |
| 3     | Drop `typing_indicators` from publication | one migration line | small, free                    |
| 4     | Scope `useUnreadCount`                    | small PR           | largest production win         |
| 5     | Local Supabase for CI (+ upstream #649)   | medium             | CI → zero                      |

Steps 2-4 are cheap and can land before the deadline regardless of what step 1 reveals. Step 5 is the structural fix. (It does **not** resolve the CI mutex problem on its own — see the §7 correction.)

**Open question this doc cannot close:** the CI estimate covers the overage but not the baseline. Do not treat step 5 as sufficient until the Usage dashboard confirms where the other ~2.2M originates.

> **Closed 2026-09-07.** There was no production baseline — the database is effectively empty (2 messages, 78 `auth.users`). CI accounted for essentially the whole bill. Steps 2-4 landed as #227/#228 and are now measured in §10; step 5 is re-costed in the correction above.

---

## 10. Outcome — measured 2026-09-07

Three PRs landed from §9: **#226** (this doc), **#227** (redundant `conversations` UPDATE deleted at three call sites; `typing_indicators` unpublished), **#228** (`useUnreadCount` scoped server-side). This section is the measurement §9 said to wait for.

### The confound, and how it was removed

@schlajo's figures — 2,859,882 Realtime messages in the 26 Jul–25 Aug cycle against 363,613 by day 12 of 26 Aug–26 Sep — do not on their own show the fix worked, because **CI volume also fell between the two cycles**. The effect has to be normalised against CI.

E2E run counts from `gh run list --workflow=e2e.yml --created <range>`, converted to **shard-runs** (a push or cron run is 24 shards, a chromium-only PR run is 8):

|                           | prev (26 Jul–25 Aug)           | curr (26 Aug–06 Sep) |
| ------------------------- | ------------------------------ | -------------------- |
| runs                      | 160 (67 push / 88 PR / 5 cron) | 45 (20 / 24 / 1)     |
| **shard-runs**            | **2,432**                      | **696**              |
| full-matrix share of runs | 45.0%                          | 46.7%                |

The run _mix_ is nearly identical, so shard-runs is a fair denominator.

### The result — MAU and egress are the control variables

| metric                | prev / shard-run | curr / shard-run | change     |
| --------------------- | ---------------- | ---------------- | ---------- |
| **Realtime messages** | 1,175.9          | **522.4**        | **−55.6%** |
| MAU (control)         | 19.0             | 18.6             | −2.4%      |
| Egress MB (control)   | 2.28             | 2.19             | −3.8%      |

**Two independent controls held flat while Realtime halved.** Three corroborations:

- **Mechanism.** Implied fan-out — Realtime divided by published row-changes per run — falls **4.87× → 2.16×**. That is precisely what removing the table-wide `messages` binding every signed-in browser context held should do, and it matches §6's cross-shard argument.
- **Cross-validation.** Predicting MAU from E2E fixture counts (~438 billable identities per full run, ~146 per chromium PR run) gives **12,702** against **12,934 billed** — 1.8% error. MAU is 100% CI churn; `auth.users` holds 78 rows, so none of it persists.
- **Conservative.** Since #244, a PR touching `e2e.yml` or `playwright.config.ts` runs all 24 shards. Zero such PRs merged in the current cycle and five in the previous one, so the current shard count is if anything _under_-stated and the true reduction is larger.

### Deadline verdict

18 Sep is day 23 of the current cycle. Straight-line from day 12: Realtime ~35% of quota, MAU ~50%, egress ~58%. **Nothing was required before the restriction date**, and the dedicated CI project was not needed for it.

### The constraint moved — see #294

Realtime was never the only metric over the line, and #227/#228 cut only Realtime:

| prev cycle actual | / quota               |                   |
| ----------------- | --------------------- | ----------------- |
| Realtime          | 2,859,882 / 2,000,000 | **143% — OVER**   |
| **Egress**        | **5.417 / 5 GB**      | **108% — OVER**   |
| MAU               | 46,284 / 50,000       | 93% — at the line |

At post-fix rates, **egress trips first** — at 0.96× the busiest month on record, against 1.11× for MAU and 1.57× for Realtime. If CI volume merely returns to July/August levels, egress goes over again while Realtime stays comfortable. Tracked in [#294](https://github.com/TortoiseWolfe/RescueDogs/issues/294), along with the first lever: **chromium-only on pushes to `main`**, which cuts shard-runs 44% and takes Jul/Aug-pace egress from 104% to 58%.

### Live state confirmed via the Management API

| check                                                   | result                                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typing_indicators` in `supabase_realtime`              | **gone** — #227's migration half was applied                                                                                                         |
| `useUnreadCount` scoping on `origin/main`               | present; `filter: conversation_id=in.(…)`, byte-identical blob since `cf32f27d`                                                                      |
| new `.channel()` in the 28 `src/` commits since the fix | **none** — shelter portal, browse and pet photos are all fetch-on-demand                                                                             |
| `REPLICA IDENTITY FULL`                                 | still on 6 of 8 published tables (`payment_results`, `subscriptions` are `default`) — §3's third item, still open                                    |
| unfiltered subscriptions                                | 5 remain (`conversations`, `conversation_members`, `user_connections`, `payment_results`, `subscriptions`) — all route-scoped, none globally mounted |
| row counts                                              | 78 `auth.users`, 2 `messages`, 3 `conversations`, 5 `applications`, 17 `pets`                                                                        |
