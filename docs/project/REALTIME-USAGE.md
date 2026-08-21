# Supabase Realtime usage — investigation and recommendation

**Issue:** [#224](https://github.com/TortoiseWolfe/RescueDogs/issues/224) · **Deadline:** Fair Use Policy applies **2026-09-19** · **Status:** decision doc, no code changes

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

**That hazard no longer exists.** The mutex serializes every E2E run in the repository — the same mutex that has been starving the CI queue for hours at a time (see [#210](https://github.com/TortoiseWolfe/RescueDogs/issues/210), [#214](https://github.com/TortoiseWolfe/RescueDogs/issues/214)). Moving CI off the shared project removes its remaining rationale entirely.

---

## 8. Recommendation

### Primary — move CI E2E off the shared cloud project

**The local Supabase stack already exists in this repo.** It was built in #121/#122 (2026-06-03) and never adopted for CI:

- `docker compose --profile supabase` brings up db, kong, auth, rest, realtime, storage, meta, studio, mailpit
- `pnpm use:local` / `pnpm dev:local` switch env and seed; `.env.local-supabase` is committed
- the monolithic migration is applied automatically on first boot, via a deliberate single-file mount whose comment documents the two bugs that made a directory mount fail
- `playwright.config.ts` only sets `baseURL` — the Supabase URL is pure env, so redirecting E2E is an env swap plus a compose step

**One gap blocks it.** Realtime resolves its tenant from the _first label of the Host header_, and `docker/supabase/kong.yml:125,142` points at `http://supabase-realtime:4000` — a single-label host with no tenant, so the socket can never join. Upstream ScriptHammer fixed exactly this in **#649**: `realtime-dev.supabase-realtime` as both the Kong upstream and the `container_name`, plus a `command:` that runs the Ecto migrations and seeds the tenant. Our `kong.yml` has not changed since March. **It is a two-file cherry-pick.**

Effect: CI's Realtime contribution → **zero**. No second project slot, no monthly cost, and the mutex rationale in §7 disappears.

One hazard to plan for: `container_name` is **global**, not namespaced by `COMPOSE_PROJECT_NAME`. A local RescueDogs stack would collide with a running ScriptHammer one. Harmless in CI, which is isolated per runner.

### Secondary — scope the unfiltered subscriptions

Independently valuable, because it cuts **production** fan-out rather than CI, and upstream shares every one of these bugs:

1. **`useUnreadCount`** — filter server-side, subscribe only on `/messages`, or drop the badge. Biggest single win.
2. **Delete the redundant `conversations` UPDATE** at `message-service.ts:488`. Free — the trigger already does it.
3. **Remove `typing_indicators` from the publication.** No reader, no writer.
4. **`conversations` / `conversation_members`** — scope to the user's own conversations.
5. Consider narrowing `REPLICA IDENTITY FULL` on `messages`, but verify nothing reads `payload.old` first.

### Fallback — dedicated CI Supabase project (ticket option A)

If the local stack proves unstable in CI. Costs the second free project slot and needs the migration kept in sync, but it is simple and well understood.

### Rejected — Pro plan (ticket option D)

At 4.4% over, $25/month treats a symptom. Revisit only if §2's dashboard numbers show the ~2.2M baseline is legitimate product traffic rather than fan-out.

### Upstream (ticket option E)

Send items 1-3 to ScriptHammer. The unfiltered `useUnreadCount` binding is byte-identical there.

---

## 9. Sequencing against the 2026-09-19 deadline

| Order | Action                                    | Effort             | Est. reduction                 |
| ----- | ----------------------------------------- | ------------------ | ------------------------------ |
| 1     | Get the dashboard numbers (§2)            | @schlajo, minutes  | — attributes the missing ~2.2M |
| 2     | Delete redundant `conversations` UPDATE   | one line           | ~⅓ of send-path fan-out        |
| 3     | Drop `typing_indicators` from publication | one migration line | small, free                    |
| 4     | Scope `useUnreadCount`                    | small PR           | largest production win         |
| 5     | Local Supabase for CI (+ upstream #649)   | medium             | CI → zero                      |

Steps 2-4 are cheap and can land before the deadline regardless of what step 1 reveals. Step 5 is the structural fix and also resolves the CI mutex problem.

**Open question this doc cannot close:** the CI estimate covers the overage but not the baseline. Do not treat step 5 as sufficient until the Usage dashboard confirms where the other ~2.2M originates.
