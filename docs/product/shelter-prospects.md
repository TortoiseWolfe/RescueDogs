# Shelter & rescue prospect log

**Purpose:** Field notes on how real orgs run listings + applications, so outreach and product decisions stay grounded.

**Audience:** Raised Paws / Tech Stack Devs team (you).

**Related:** [VISION.md](./VISION.md) · [FIRST-PARTNER-ONBOARDING.md](./FIRST-PARTNER-ONBOARDING.md) · [FIRST-PARTNER-ZOOM-RUNBOOK.md](./FIRST-PARTNER-ZOOM-RUNBOOK.md) · [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md) · [SHELTER-SITE-COPY.md](./SHELTER-SITE-COPY.md)

---

## How to use

1. Add a **new row** when you discover an org (under ~2 minutes).
2. Fill what you can from their **public** site / socials — don’t invent.
3. Update **Status** and **Last touch** after every message or call.
4. Prefer **patterns** over perfection (e.g. “Google Form + Petfinder + Facebook”).

### Privacy

- Prefer **public** URLs and process notes.
- Do **not** paste private Facebook DMs, phone numbers you were given privately, or applicant PII into this file if the repo is public.
- Keep private contact details in a personal sheet/Notion if needed; link by org name here.

### Capture habit (when you visit a site)

| Method                         | Use when                                                                                     | Skip when                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Browser AI / short summary** | You want a fast skim: Apply button destination, Petfinder, form tool, foster-only vs shelter | The page is a login wall or the AI invents details — always spot-check    |
| **1–3 screenshots**            | Apply flow is non-obvious, or you want to remember a specific UI later                       | You’re screenshotting entire sites (noise); avoid capturing personal info |
| **Neither**                    | Org is a one-line “not a fit” — just Status + Notes                                          |                                                                           |

**Default:** browser AI (or your own 3-bullet notes) → paste into Notes. Screenshots only for “I need to remember this screen.” Store screenshots outside the repo (Drive / folder) unless you’re deliberately attaching a public asset.

---

## Status legend

| Status       | Meaning                          |
| ------------ | -------------------------------- |
| `cold`       | Found, not contacted             |
| `messaged`   | Outreach sent, waiting           |
| `discovery`  | Call/chat scheduled or done      |
| `pilot-talk` | Discussing a small pilot         |
| `pilot`      | Active early-access partner      |
| `pass`       | Not a fit / declined / paused    |
| `watch`      | Interesting stack; revisit later |

---

## Prospects

### Once Upon A Prayer

| Field                | Value                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type**             | Foster-based rescue (visits by appointment only)                                                                                                                                                                                                                                                                                                                                   |
| **Location**         | O’Fallon, IL (Petfinder org profile)                                                                                                                                                                                                                                                                                                                                               |
| **Website**          | No dedicated site required for pilot — listings live on Petfinder                                                                                                                                                                                                                                                                                                                  |
| **How they apply**   | Mixed: Petfinder **Start Your Inquiry** + email/PDF attachment + (pilot) Raised Paws pet page (`/dogs/detail?id=`)                                                                                                                                                                                                                                                                 |
| **Listing**          | [Petfinder — Once Upon A Prayer](https://www.petfinder.com/member/us/il/o-fallon/once-upon-a-prayer-il885/)                                                                                                                                                                                                                                                                        |
| **Shelter mgmt app** | Email folders by month/year + hard-copy dog files + Word approved/denied list + microchip spreadsheet (no SMS / Shelterluv observed)                                                                                                                                                                                                                                               |
| **Contact**          | Facebook connection (private — keep details off-repo); public Petfinder org also lists email / phone                                                                                                                                                                                                                                                                               |
| **Status**           | `pilot-talk` — Zoom onboarding; 3 dogs + bio links                                                                                                                                                                                                                                                                                                                                 |
| **Last touch**       | 2026-08-27                                                                                                                                                                                                                                                                                                                                                                         |
| **Fit**              | First pilot — Pattern B (Raised Paws + keep Petfinder inquiry / email filing)                                                                                                                                                                                                                                                                                                      |
| **Notes**            | See **Petfinder listing IA** below. Volunteer-run; evenings/weekends. Dogs only. Process: inquiry/prescreen → references → vet records → email Q&A → approve → Meet & Greet with foster → adopt or pass → next in line. Wants phone-first apply link instead of Word attachment. Pilot: **3 Petfinder dogs** with Raised Paws blurb in bio; leave Inquiry / Match / Sponsor alone. |

#### Petfinder listing IA (captured 2026-08-26)

**Profile fields they already publish (example dog pattern):** name; breed mix; age group + years; sex; size/weight; coat; spay/neuter; vaccinated; special needs; kids / dogs / cats compatibility flags; fixed adoption fee; multi-photo gallery.

**Narrative pattern:** (1) personality hook, (2) background/origin, (3) hard requirements (e.g. cat-free home / prey drive).

**Adopter conversion paths on the listing (all stay live during pilot):**

```
Petfinder search listing
   ├── 1. "Start Your Inquiry"  → Petfinder embedded form → rescue reviews lead
   ├── 2. "See How You Match"   → Petfinder match tool (pre-screen)
   ├── 3. "Become a Sponsor"    → Petfinder sponsorship (not apply)
   └── 4. Off-platform          → org profile / mailto / phone → direct contact
```

**Raised Paws insertion point:** story/bio text only — link to the **pet detail page** (`/dogs/detail?id=`), not a raw `/adopt?pet=` URL. Optional second link: rescue listing (`/dogs?shelter=`). Handout: [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md).

**Product ready for this pilot:** email on new app ([#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260)), add staff by email ([#220](https://github.com/TortoiseWolfe/RescueDogs/issues/220)), multi-rescue switcher for ops ([#261](https://github.com/TortoiseWolfe/RescueDogs/issues/261)).

---

### Template (copy for next org)

```markdown
### Org name

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| **Type**             | shelter / foster rescue / municipal / other         |
| **Location**         | city, state                                         |
| **Website**          | https://…                                           |
| **How they apply**   | Google Form / Petfinder Apply / email / PDF / other |
| **Listing**          | Petfinder / Adopt-a-Pet / own site / Facebook       |
| **Shelter mgmt app** | Shelterluv / Pawlytics / spreadsheet / unknown      |
| **Contact**          | (public only, or “see personal CRM”)                |
| **Status**           | cold                                                |
| **Last touch**       | YYYY-MM-DD                                          |
| **Fit**              | high / medium / low                                 |
| **Notes**            | 2–5 bullets: process, pain, stack                   |
```

---

## Pattern scratchpad

Update when you see the same thing 3+ times:

- **Intake:** Petfinder Inquiry + email/PDF attachment (Once Upon A Prayer); want a single apply link with status
- **Listings:** Petfinder-first foster rescue; bio carries personality + hard requirements; fee on listing
- **Status / “any update?”:** Manual email / Word filing today → Raised Paws tracker for pilot cohort
- **Common apps:** Petfinder native CTAs (Inquiry, Match, Sponsor) stay; portal link lives in bio text

---

## Changelog

| Date       | Change                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 2026-08-27 | Once Upon A Prayer: Petfinder IA + conversion paths; #260/#220/#261 noted as shipped for pilot |
| 2026-08-26 | File created; Once Upon A Prayer seeded from outreach thread                                   |
