# First-partner Zoom runbook (ops)

**Audience:** Raised Paws operators running the first real shelter onboarding call  
**Partner handout:** [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md)  
**Prospect log:** [shelter-prospects.md](./shelter-prospects.md)

Use this for the live walkthrough: account → rescue → 3 dogs → Petfinder bio
links → what happens when someone applies.

---

## Shipped for this pilot (don’t re-promise as “coming soon”)

| Capability                          | Ticket                                                         | Notes                                                                 |
| ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Email on new application            | [#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260) | Goes to rescue **contact email** — confirm it on create / shelter row |
| Manager adds teammate by email      | [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220) | `/shelter` → **Add a teammate**; invitee must already have an account |
| Multi-rescue + Active rescue switch | [#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261) | Same ops login can be invited onto her rescue; switcher when 2+       |

Still out of scope: invite emails, remove staff, Petfinder API sync, custom prescreen fields.

---

## Before the call

- [ ] Partner has **not** sent dog info ahead — they’ll upload live (faster learning).
- [ ] You have [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md) ready to paste into a Google Doc after the call.
- [ ] Confirm the rescue’s **contact email** is one she reads — that address gets the new-application alert ([#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260)).
- [ ] Backup access: have her add **your** Raised Paws email via **Add a teammate** ([#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220)). Multi-membership works ([#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261)) — after invite, open `/shelter` and pick her rescue in **Active rescue**.
- [ ] Skim her Petfinder org + one live dog page (see [shelter-prospects.md](./shelter-prospects.md)) so Part 3 matches what she already clicks.

---

## Call agenda (~45–60 min)

### Part 1 — Account + rescue (~20 min)

1. Go to [raisedpaws.com](https://raisedpaws.com) → **Sign up** (her email, her password).
2. Clarify: **email login only** — username is optional later for messaging, not sign-in.
3. Open **`/shelter`** → **Create your rescue** if prompted (name, city, state, zip, **contact email**).
4. Same login for `/account` and `/shelter` — not a second account.
5. Optional: she adds you as staff (**Add a teammate**) so you can help without SQL.

### Part 2 — Upload 3 dogs (~15 min)

1. **Pets** → **Add pet** for each dog: photo, name, age, breed, notes/temperament
   (pull from her Petfinder story: hook, hard requirements, fee if she wants it in notes).
2. After each save, open [raisedpaws.com/dogs](https://raisedpaws.com/dogs) → **Meet {name}** → copy the pet page URL for Petfinder:  
   `https://raisedpaws.com/dogs/detail?id=<pet-uuid>`  
   (Applicants use **Apply to Adopt** on that page — not a raw `/adopt?pet=` link in the bio.)
3. Confirm each dog appears on [raisedpaws.com/dogs](https://raisedpaws.com/dogs) and the pet page loads.
4. Send her the **rescue listing** link for “all our dogs on Raised Paws”:  
   `https://raisedpaws.com/dogs?shelter=<shelter-uuid>`

### Part 3 — Petfinder (~10 min)

Her listing already has Petfinder-native actions. **Do not** try to replace those buttons:

| Petfinder control           | Keep? | Pilot note                                       |
| --------------------------- | ----- | ------------------------------------------------ |
| **Start Your Inquiry**      | Yes   | Built-in lead form → she reviews as today        |
| **See How You Match**       | Yes   | Their compatibility pre-screen                   |
| **Become a Sponsor**        | Yes   | Unrelated to apply                               |
| Org profile / email / phone | Yes   | Off-platform contact stays                       |
| **Story / bio text**        | Edit  | Paste Raised Paws apply blurb for **pilot dogs** |

Paste per-dog copy from the handout (or [SHELTER-SITE-COPY.md](./SHELTER-SITE-COPY.md)) **into the narrative**, near the top after the personality hook.

Say out loud: Petfinder inquiry and Raised Paws application can both happen during the pilot — Pattern B. For the three pilot dogs, treat the Raised Paws link as the preferred **full application** path when someone follows it.

### Part 4 — Applications + parallel workflow (~15 min)

Walk through **Applications** and the handout **parallel workflow** table (Inquiry vs Raised Paws link vs email/call).

**Live test (recommended):** second email or your test adopter applies for one dog end-to-end; confirm she gets the **#260** email and the row appears.

### Part 5 — Expectations (~5 min)

- Pattern **B**: Raised Paws alongside Petfinder inquiry + her email/PDF filing.
- Universal form ≠ full prescreen day one — gap-fill after real apps if needed.
- You may watch the first 3 dogs for support — she approves adopters.
- Email on apply is live ([#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260)) — still bookmark `/shelter` as source of truth.

---

## Parallel workflow rule (say out loud)

> For these three dogs only, if someone uses the Raised Paws link in the bio, that application is the queue for that dog in Raised Paws. Petfinder’s own Inquiry button, Match tool, email, and phone still work the way they do today — handle those like you always have. Nothing else changes until you’re comfortable.

---

## When someone applies (product truth)

| Step | Adopter                                   | Staff                                                                                     |
| ---- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | Opens pet page (`/dogs/detail?id=<uuid>`) | —                                                                                         |
| 2    | Clicks **Apply to Adopt** on the pet page | —                                                                                         |
| 3    | Signs up / signs in (**email**)           | —                                                                                         |
| 4    | Fills universal application               | Contact email gets alert ([#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260)) |
| 5    | Lands on live status tracker              | Row appears in `/shelter` as **Submitted**                                                |
| 6    | Checks **My Applications**                | Opens detail → email, answers, advance status, optional Message                           |

**Gaps today**

- No staff roster or **remove staff** — adding is one-way in the UI; removal is still SQL.
- No invite emails — a teammate must create their own account before the manager can add them ([#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220) out of scope: static hosting).
- No Petfinder API sync — bio paste is manual for the pilot.

---

## Staff membership (ops)

Staff links **user UUID → shelter**, not a new email account. Existing Raised Paws login is required.

**Add a teammate (manager only, [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220)):** on `/shelter`, scroll to **Add a teammate**, enter their account email, submit. Hidden for `role=staff`; Postgres enforces the same rule.

Invitee must have a **confirmed** account. They may already belong to another rescue ([#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261)) — after invite, they use **Active rescue** to switch.

Manual SQL fallback if needed: [FIRST-PARTNER-ONBOARDING.md](./FIRST-PARTNER-ONBOARDING.md) §3.

Tell partner if you join as backup staff:

> I may add my Raised Paws login as backup staff so I can help if something breaks — you stay the manager for adoption decisions.

---

## After the call

- [ ] Send partner the Google Doc / PDF from [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md).
- [ ] Update [shelter-prospects.md](./shelter-prospects.md) — status, last touch, pilot scope (3 dogs).
- [ ] Schedule mid-pilot check-in (1–2 weeks).
- [ ] Capture friction → backlog (custom fields, remove-staff, Petfinder sync only if blocking).

---

## Related

- [#117](https://github.com/TortoiseWolfe/RescueDogs/issues/117) — pilot agreement (closed; doc lives here)
- [#138](https://github.com/TortoiseWolfe/RescueDogs/issues/138) — first-partner onboarding SQL
- [#218](https://github.com/TortoiseWolfe/RescueDogs/issues/218) — self-serve create rescue (shipped)
- [#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220) — add staff by email (shipped)
- [#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260) — email staff on new application (shipped)
- [#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261) — multi-rescue staff + switcher (shipped)
- [AUTH-SETUP.md](../AUTH-SETUP.md) — one sign-in, portal params cosmetic
