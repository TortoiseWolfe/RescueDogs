# First-partner pilot agreement + onboarding checklist

**Status:** v0 outline for partner conversation  
**Audience:** Raised Paws team + first pilot shelter contact  
**Not:** a public marketing page, in-app legal flow, or a substitute for legal review

**How we use this doc**

| Artifact                             | Where it lives                                                                                       | Why                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Pilot agreement**                  | Copy this outline into a private Doc/PDF for the shelter; keep this file as the team source of truth | Shelter-specific terms; may need legal eyes later   |
| **Ops onboarding checklist**         | Bottom of this file (and the tracking issue)                                                         | Internal: provision shelter, pets, links, check-ins |
| **Public “How a pilot works” blurb** | Optional later on `/for-shelters`                                                                    | Sales copy only — not a contract                    |
| **In-app staff checklist**           | Deferred until after the first real pilot                                                            | Build once we know the friction                     |

Aligns with [VISION.md](./VISION.md) — Shelter onboarding and application strategy.

---

## Pilot agreement outline (v0)

### 1. Purpose

- 30–60 day pilot to prove: apply → shelter pipeline → live applicant status (anti-ghosting).
- Raised Paws runs **alongside** existing tools; it does not replace them in this phase.

### 2. What the shelter keeps

- Petfinder / website / social listings
- Existing application PDF / form / phone process (for non-pilot channels)
- Existing shelter management software as animal source of truth
- Historical applications in their current systems (we do not migrate old apps)

### 3. What Raised Paws provides

- Shelter account + staff logins (invite-only)
- Currently available pets listed for Apply (subset or all — agreed in writing)
- In-app application + status history for applicants who use the Raised Paws link
- Shelter pipeline dashboard for triage (`/shelter`)
- Optional: link to shelter packet / PDF as a pipeline step

### 4. Scope of the pilot (fill in per partner)

- Start date / end date / review meeting date: \_\_\_
- Animals in scope:
  - [ ] all available
  - [ ] dogs only
  - [ ] cats only
  - [ ] named list / count: \_\_\_
- Channels that point to Raised Paws:
  - [ ] website
  - [ ] Petfinder bio
  - [ ] Facebook
  - [ ] QR at desk
  - [ ] other: \_\_\_
- Staff who will use `/shelter`: names / emails: \_\_\_
- Success criteria (examples): ≥N applications with status updates; staff open pipeline weekly; zero “we lost your app” complaints in the pilot cohort: \_\_\_

### 4b. Applications (Raised Paws form vs shelter form)

Raised Paws universal application is the **system of record** for intake, pipeline, and live status for applicants who use the Raised Paws Apply link. The shelter may keep their PDF / Google Form / packet — those are **supplementary**, not where status dies in an inbox.

Pick one pattern for this pilot (fill in):

| Pattern                              | When                           | Adopter experience                                                                        |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------- |
| **A — Raised Paws only**             | Flexible process               | One form → full tracker                                                                   |
| **B — Raised Paws + export**         | They want a PDF on file        | Fill ours once; export/print or copy into their form                                      |
| **C — Raised Paws + shelter packet** | Legally required external form | Step 1: ours (status starts). Step 2: link to their packet. Staff marks “packet received” |

- Pattern chosen for this pilot: [ ] A [ ] B [ ] C
- Do **not** rebuild our form to fully mirror theirs. Gap-fill only if they require fields we lack.
- Do **not** make their form the primary Apply target for pilot pets (breaks anti-ghosting).
- Detail: [VISION.md — Universal application vs shelter-specific forms](./VISION.md#universal-application-vs-shelter-specific-forms).

### 5. Data & privacy (plain language)

- Applicant data submitted through Raised Paws is used to process adoption applications and show status — not sold.
- Shelter staff see applications for their shelter only.
- Pets listed are a **working set** of available animals, not a full historical database export.
- Either party can end the pilot; shelter can stop linking to Raised Paws at any time.

### 6. Responsibilities

**Raised Paws / ops**

- Provision shelter + staff
- First pet load (import/copy/photo) or train staff on Add pet
- Short walkthrough of pipeline + demo accounts if helpful
- Named contact for questions during the pilot

**Shelter**

- Designate 1–2 staff owners
- Place agreed Apply / track links on chosen channels
- Use the pipeline for applications that come through Raised Paws
- Keep non-pilot channels on current process until review

### 7. What we are not asking in this phase

- Turning off Petfinder or the website
- Abandoning legal/county PDFs
- Dual data-entry forever
- Pulling their full animal DB or old applications

### 8. After the pilot (options)

- Continue / expand animals & channels
- Add self-serve pet management habits
- Discuss future sync (Petfinder / Shelterluv / PetPoint) — not required to start
- Pause with no hard feelings

### 9. Sign-off (non-legal placeholder)

- Shelter contact name / role / date: \_\_\_
- Raised Paws contact / date: \_\_\_
- Note: formal legal agreement TBD if required by the shelter's board or municipality

---

## Ops onboarding checklist

Use when provisioning the first real shelter (internal). Full SQL / Management
API steps: [FIRST-PARTNER-ONBOARDING.md](./FIRST-PARTNER-ONBOARDING.md) (#138).

- [ ] Create `shelters` row (name, city, state, zip, contact)
- [ ] Add `shelter_members` for agreed staff
- [ ] Load currently available pets (manual Add pet and/or one-time import) + photos
- [ ] Confirm `/dogs` `/cats` show their available animals
- [ ] Confirm staff can open `/shelter` pipeline and advance status
- [ ] Give shelter: Apply links, optional QR, short staff one-pager
- [ ] Schedule mid-pilot and end-of-pilot check-ins
- [ ] Capture feedback → backlog (import UX, packet step, messaging, filters)

---

## Related

- Tracking issue: [#117](https://github.com/TortoiseWolfe/RescueDogs/issues/117)
- Vision: [VISION.md](./VISION.md)
- Business model / onboarding tiers: [BUSINESS-MODEL.md](./BUSINESS-MODEL.md)
- Live site: [raisedpaws.com](https://raisedpaws.com)
