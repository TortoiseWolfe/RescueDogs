# First-partner Zoom runbook (ops)

**Audience:** Raised Paws operators running the first real shelter onboarding call  
**Partner handout:** [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md)  
**Prospect log:** [shelter-prospects.md](./shelter-prospects.md)

Use this for the live walkthrough: account → rescue → 3 dogs → Petfinder links
→ what happens when someone applies.

---

## Before the call

- [ ] Partner has **not** sent dog info ahead — they'll upload live (faster learning).
- [ ] You have [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md) ready to paste into a Google Doc after the call.
- [ ] Confirm open tickets: [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220) (add staff by email), [#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260) (email on new application).
- [ ] If you need backup access to their pipeline: plan for **#220** or a dedicated ops email — one membership per user today; see **Staff membership** below.

---

## Call agenda (~45–60 min)

### Part 1 — Account + rescue (~20 min)

1. Go to [raisedpaws.com](https://raisedpaws.com) → **Sign up** (her email, her password).
2. Clarify: **email login only** — username is optional later for messaging, not sign-in.
3. Open **`/shelter`** → **Create your rescue** if prompted (name, city, state, zip).
4. Same login for `/account` and `/shelter` — not a second account.

### Part 2 — Upload 3 dogs (~15 min)

1. **Pets** → **Add pet** for each dog: photo, name, age, breed, notes/temperament.
2. After each save, open **Edit** — copy pet UUID from URL for Petfinder link:  
   `https://raisedpaws.com/adopt?pet=<uuid>`
3. Confirm each dog appears on [raisedpaws.com/dogs](https://raisedpaws.com/dogs).

### Part 3 — Petfinder (~10 min)

Paste per-dog copy from the handout (or [SHELTER-SITE-COPY.md](./SHELTER-SITE-COPY.md)).

### Part 4 — Applications + parallel workflow (~15 min)

Walk through **Applications** tab and the handout **parallel workflow** table.

**Live test (recommended):** second email or your test adopter applies for one dog end-to-end.

### Part 5 — Expectations (~5 min)

- Pattern **B** for this partner: Raised Paws + she keeps PDF/email filing if she wants.
- Universal form ≠ full prescreen day one — gap-fill after real apps if needed.
- You may watch the first 3 dogs for support — she approves adopters.
- Email when someone applies: [#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260) — bookmark `/shelter` until shipped.

---

## Parallel workflow rule (say out loud)

> For these three dogs only, anyone who uses the Petfinder link goes through Raised Paws — that's the queue for that dog. Anyone who ignores the link and emails you the old way, you handle like today. Nothing else changes until you're comfortable.

---

## When someone applies (product truth)

| Step | Adopter                         | Staff                                                           |
| ---- | ------------------------------- | --------------------------------------------------------------- |
| 1    | Clicks `/adopt?pet=<uuid>`      | —                                                               |
| 2    | Signs up / signs in (**email**) | —                                                               |
| 3    | Fills universal application     | —                                                               |
| 4    | Lands on live status tracker    | Row appears in `/shelter` as **Submitted**                      |
| 5    | Checks **My Applications**      | Opens detail → email, answers, advance status, optional Message |

**Gaps today**

- No email to shelter on new application — [#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260).
- No in-app **Add staff** — [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220).
- One rescue membership per user — multi-pilot ops: [#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261); add staff UI: [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220).

---

## Staff membership (ops)

Staff links **user UUID → shelter**, not a new email account. Existing Raised Paws login is required.

**No in-app add-staff button yet** — [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220). Manual SQL only if urgent: [FIRST-PARTNER-ONBOARDING.md](./FIRST-PARTNER-ONBOARDING.md) §3.

**If you're already on another rescue:** don't add yourself via SQL without a plan — UI shows one shelter only. Prefer: dedicated ops email, Supabase query, or wait for multi-membership + switcher.

Tell partner if you join as backup staff:

> I may add a backup staff login so I can help if something breaks — you stay the manager for adoption decisions.

---

## After the call

- [ ] Send partner the Google Doc / PDF from [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md).
- [ ] Update [shelter-prospects.md](./shelter-prospects.md) — status, last touch, pilot scope (3 dogs).
- [ ] Schedule mid-pilot check-in (1–2 weeks).
- [ ] Capture friction → backlog ([#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260), #220, custom fields only if blocking).

---

## Related

- [#117](https://github.com/TortoiseWolfe/RescueDogs/issues/117) — pilot agreement (closed; doc lives here)
- [#138](https://github.com/TortoiseWolfe/RescueDogs/issues/138) — first-partner onboarding SQL
- [#218](https://github.com/TortoiseWolfe/RescueDogs/issues/218) — self-serve create rescue (shipped)
- [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220) — add staff by email (open)
- [#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261) — multi-rescue staff + switcher (open)
- [#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260) — email staff on new application (open)
- [AUTH-SETUP.md](../AUTH-SETUP.md) — one sign-in, portal params cosmetic
