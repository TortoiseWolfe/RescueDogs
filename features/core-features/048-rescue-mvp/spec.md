# 048 — Rescue MVP: The Anti-Ghosting Loop (As-Is)

> **Status: AS-IS DOCUMENTATION.** This spec was written _after_ the feature
> shipped (commit `a15bc9c`, "feat(mvp): the anti-ghosting loop"). It
> documents the application → pipeline → tracker loop **as it currently
> exists in code**, and the wireframes under [§ UI Mockup](#ui-mockup) were
> retro-fitted from the live routes — not authored ahead of implementation.
> Its purpose is to close the "built without a spec" gap and give the
> wireframes a documented source of truth. It is descriptive, not
> prescriptive.

## 1. Product Requirements

### What

A three-stage adoption pipeline that makes an application's status
continuously visible to the adopter, so no one is left wondering what
happened ("ghosted"):

1. **Apply** — a universal adoption application (`/adopt`).
2. **Pipeline** — a shelter-staff dashboard to triage and advance
   applications (`/shelter`, `/shelter/application`).
3. **Track** — a live, realtime status tracker the adopter watches from the
   moment they submit (`/applications`, `/applications/status`).

### Why

Constitution Principle I — **No One Gets Ghosted**. Traditional adoption
applications vanish into a shelter inbox; the applicant never hears back.
This loop guarantees every status change is pushed to the adopter in
realtime, with an auditable history.

### Success criteria (as observed in the shipped code)

- An authenticated adopter can submit one application per pet; a duplicate
  submission is rejected with a friendly message (`23505` unique violation).
- The adopter sees status changes **without refreshing** — the tracker is
  subscribed via `useApplicationRealtime`, with a focus/visibility refetch
  as a backstop.
- Shelter staff (and only staff — `ShelterGate`) see their shelter's
  applications, filter by status, and advance an application along an
  allowed transition, optionally attaching a note the adopter can read.
- The staff review shows the **frozen application snapshot** exactly as
  submitted, never the adopter's live profile (Constitution Principle III).

### Out of scope (not in this MVP)

- Pet intake / shelter onboarding flows (pets and shelters are seeded).
- Messaging between adopter and shelter (separate feature).
- Multi-shelter membership management.

## 2. The Five Routes (as built)

| #   | Route                  | Actor   | Role in the loop                                | Source                                                                        |
| --- | ---------------------- | ------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `/adopt`               | Adopter | **Apply** — universal application form          | `src/app/adopt/page.tsx`, `ApplicationForm`                                   |
| 2   | `/applications`        | Adopter | **Track** — list of my applications             | `src/app/applications/page.tsx`, `ApplicationCard`                            |
| 3   | `/applications/status` | Adopter | **Track** — live status of one application      | `src/app/applications/status/page.tsx`, `StatusTimeline`                      |
| 4   | `/shelter`             | Staff   | **Pipeline** — dashboard of all applications    | `src/app/shelter/page.tsx`, `ApplicationsTable`, `ShelterGate`                |
| 5   | `/shelter/application` | Staff   | **Pipeline** — review + advance one application | `src/app/shelter/application/page.tsx`, `ApplicationDetail`, `StatusDropdown` |

All five are client components behind `ProtectedRoute`; `/shelter/*` is
additionally behind `ShelterGate` (redirects non-staff to `/`). The app is a
static export — all data access is client-side Supabase with RLS.

## 3. The Status Pipeline

Defined in `src/types/applications.ts`.

**Happy path (`STATUS_ORDER`):**

```
Submitted → Under Review → Reference Check → Home Visit → Approved
```

**Terminal branches** (replace the final `Approved` step in the timeline):

- `Not Selected` (`not_selected`) — shelter declines.
- `Withdrawn` (`withdrawn`) — adopter withdraws (only allowed while the
  status is non-terminal).

**Allowed staff transitions** (`StatusDropdown`, from
`STATUS_TRANSITIONS`; `withdrawn` is adopter-only via the
`withdraw_application()` RPC, deliberately absent from this map):

| From                                | To options                                          |
| ----------------------------------- | --------------------------------------------------- |
| Submitted                           | Under Review, Not Selected                          |
| Under Review                        | Reference Check, Home Visit, Approved, Not Selected |
| Reference Check                     | Home Visit, Approved, Not Selected                  |
| Home Visit                          | Approved, Not Selected                              |
| Approved / Not Selected / Withdrawn | (terminal — none)                                   |

**Badge colors** (`StatusBadge`): Submitted = info, Under Review = primary,
Reference Check = secondary, Home Visit = accent, Approved = success,
Not Selected = error, Withdrawn = neutral.

## 4. Per-Screen Behavior

### 4.1 `/adopt` — Apply to Adopt

Five `fieldset` sections, validated by `applicationSchema` (Zod +
react-hook-form), then a single full-width submit:

1. **This Pet** — required pet `<select>` (available pets only).
2. **About You** — full name\*, phone, street address, city/state/ZIP.
3. **Your Home** — housing situation\* (`own_house`, `own_condo`,
   `rent_house`, `rent_apartment`, `other`). **Conditional:** while renting,
   a shaded block reveals landlord-approval checkbox + landlord contact.
   "I have a yard" checkbox; **conditional** "The yard is fenced" when
   checked.
4. **Household & Pets** — adults (≥1), children (≥0), other pets (textarea).
5. **References & Experience** — vet name/phone, experience, "Why this pet?".

On submit, the answers are frozen into a `profile_snapshot` and the adopter
is routed to `/applications/status?id=…`. Empty state: "No pets available
right now." Prefills from a saved adopter profile when one exists.

### 4.2 `/applications` — My Applications

Header (`My Applications` + "Apply to adopt" button) over a list of
`ApplicationCard`s: pet photo/name/breed, current `StatusBadge`, relative
"Updated …" time, and a "View status" link into the tracker. Refetches on
window focus. Empty state invites the first application.

### 4.3 `/applications/status` — Live Status Tracker (centerpiece)

The "pizza tracker." Header (pet name + breed + large `StatusBadge`) over a
`StatusTimeline`: the five pipeline stages as steps (current stage
highlighted; terminal branch replaces `Approved`), followed by an **Updates**
list of status changes with adopter-visible shelter notes as chat bubbles.
A subtle **Withdraw application** action (confirm → "Yes, withdraw" / "Keep
my application") appears only for non-terminal statuses. Subscribed via
`useApplicationRealtime`; a stale-data warning + manual refresh covers
subscription gaps.

### 4.4 `/shelter` — Pipeline Dashboard

`ShelterGate` chrome shows the shelter name + "signed in as shelter
{role}". `ApplicationsTable`: status filter tabs with per-status **counts**
(only present statuses + the active tab get a tab), over a table — Pet,
Applicant, Status, Last update, and a per-row **Review** link. Refetches on
focus so a front-desk dashboard stays honest. Empty state: "No applications
in this view yet."

### 4.5 `/shelter/application` — Review & Advance

`ApplicationDetail` stack: pet context + status; "Why this pet" blockquote;
the **frozen application snapshot** ("Answers exactly as submitted") in four
labeled sections; **Update status** (`StatusDropdown`, allowed transitions
only, optional note); and **Status history** (chronological "From → To"
with notes). Advancing the status is the act that prevents ghosting — it
pushes a realtime update to the adopter's tracker.

## 5. UI Mockup

Retro-fitted as-is wireframes (1920×1080, validated against
`.specify/extensions/wireframe/scripts/validate.py` — all PASS). Viewable at
`/wireframes` (feature "048 - Rescue Mvp") after `pnpm run dev`/`build`.

- **Apply** — `wireframes/01-adopt-application.svg` — `/adopt`
- **My Applications** — `wireframes/02-my-applications.svg` — `/applications`
- **Status Tracker** — `wireframes/03-status-tracker.svg` — `/applications/status`
- **Shelter Pipeline** — `wireframes/04-shelter-pipeline.svg` — `/shelter`
- **Application Review** — `wireframes/05-shelter-application-detail.svg` — `/shelter/application`

## 6. Data & Constraints

- **Tables** (monolithic migration `20251006_complete_monolithic_setup.sql`):
  `shelters`, `shelter_members`, `pets`, `adopter_profiles`,
  `applications`, `application_status_history`.
- **RLS**: adopters see only their own applications; staff see only their
  shelter's. Status advancement goes through SQL functions
  (`advance_application_status`, `withdraw_application`, `is_shelter_staff`).
- **Realtime**: `applications` and `application_status_history` are in the
  `supabase_realtime` publication.
- **Static hosting**: no server routes; all logic is client-side Supabase +
  RLS + SQL functions.
- **Demo data** (`seed-rescue-demo.sql`): one shelter, 6 pets
  (incl. Biscuit/Pepper/Tank), 3 applications, 7 history rows; demo accounts
  `adopter@demo.test` / `staff@demo.test` (`DemoPass123!`).

## 7. References

- Loop implementation commit: `a15bc9c`
- Schema/seed commit: `b46ec5d`
- Types/services/realtime hook commit: `fb63f18`
- Constitution: `.specify/memory/constitution.md` (Principles I, III)
- Wireframe rules: `features/CLAUDE.md`, `.specify/extensions/wireframe/`
