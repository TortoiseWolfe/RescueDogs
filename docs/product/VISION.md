# RescueDogs Product Vision

**Purpose:** Capture the original product brainstorm, the strategic choice we made,
and what is in active build vs intentionally deferred. Use this when onboarding,
prioritizing features, or checking whether new work aligns with the rescue-first
bet — not the full ScriptHammer template surface.

**Related docs:**

- [Business model (draft)](./BUSINESS-MODEL.md) — revenue, pricing tiers, nonprofit options
- [Constitution (Principles I–V)](../../.specify/memory/constitution.md) — binding
  product and engineering principles
- [Rescue MVP spec (as shipped)](../../features/core-features/048-rescue-mvp/spec.md) —
  the anti-ghosting loop in code
- [README — live demo of the loop](../../README.md#-live-demo--try-the-loop)

---

## Market gap (why not another Petfinder?)

Most pet adoption apps (Petfinder, WeRescue, etc.) act as **search directories**:
breed, age, zip code, static photos. AI matching and basic chat exist, but the
rescue space still faces systemic bottlenecks — foster retention, shelter
burnout, post-adoption returns, and applicants who never hear back.

| Current apps focus on              | RescueDogs should focus on                                   |
| ---------------------------------- | ------------------------------------------------------------ |
| Discovery (browsing photos)        | Retention (keeping animals in homes)                         |
| High barrier (repeated long forms) | Frictionless onboarding (universal verified profiles)        |
| Shelter-centric (brick-and-mortar) | Community-centric (local micro-volunteers) — _future pillar_ |

RescueDogs is **not** trying to win as a prettier directory. The founding bet is
**pipeline transparency**: end applicant ghosting and give shelter volunteers
their time back.

---

## Five strategic pillars (original brainstorm)

These angles came from early product exploration. They are **not** all in scope
at once. Constitution **Principle V — One Loop, Proven, Then the Next** requires
proving one pillar with a real shelter before starting the next.

| #   | Pillar                        | Core idea                                                                                 | Status                     |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| 1   | **Foster ecosystem**          | Weekend / micro-fostering; foster-to-adopt concierge with check-ins and one-tap adoption  | **Deferred**               |
| 2   | **Stray rescue network**      | GPS pin + photo on a map; push alerts to nearby volunteers with crates/scanners           | **Deferred**               |
| 3   | **Anti-ghosting shelter CRM** | One universal application; shelter pipeline dashboard; Domino's-style live status tracker | **Current — founding MVP** |
| 4   | **Post-adoption retention**   | 3-3-3 rule timeline, daily tips, in-app crowdfunded medical safety net                    | **Deferred**               |
| 5   | **Lifestyle-first matching**  | Search by lifestyle ("3rd floor, WFH, loud parrot"); foster insight video feeds           | **Deferred**               |

---

## Pillar 3 in detail (what we chose first)

**The problem:** Adopters fill out multi-page applications and never hear back.
Shelters drown in "what's my status?" email. Silence is the default failure mode.

**The loop (shipped):**

1. **Apply** — universal adoption application (`/adopt`)
2. **Pipeline** — shelter staff triage and advance applications (`/shelter`)
3. **Track** — applicant watches status update live (`/applications/status`)

**Constitution alignment:**

- **Principle I — No One Gets Ghosted:** every application has a visible, truthful
  status; rejections are communicated clearly
- **Principle II — Shelter Staff Time Is Sacred:** status changes must be faster
  than writing the email they replace
- **Principle III — Applicant Data Is a Trust:** frozen application snapshots,
  RLS, no monetization of PII
- **Principle IV — The Animal's Outcome Is the Metric:** placements that stick,
  not vanity engagement metrics

**From the brainstorm, not yet built (still aligned with pillar 3):**

- Automated verification (landlord, vet references) once per universal profile
- Auto-suggest similar pets when the applied-for animal is adopted elsewhere
- Applicant-facing messaging with shelter (messaging exists in template; out of
  scope for founding MVP per `048-rescue-mvp`)

---

## Deferred pillars (intentionally parked)

These remain part of the **long-term vision** named in the constitution. They
must **not** leak into the current build as "while we're here" additions until
pillar 3 is proven with a real shelter.

### 1. Foster ecosystem

- Single-weekend fosters / field trips for high-energy dogs
- Quick onboarding, waivers, foster-to-adopt pipeline with weekly check-ins
- "Press to adopt" when a foster decides to keep the animal

### 2. Decentralized stray rescue

- Real-time map: pin GPS, photo, behavior notes for strays
- Micro-volunteer network within a radius; nearest responder with crate/scanner

### 4. Post-adoption survival kit

- "Pet parent mode" from adoption day
- Gamified 3-3-3 rule (3 days / 3 weeks / 3 months) with tips and milestones
- Community micro-donations for emergency medical costs in the first six months

### 5. Behavioral and lifestyle-first matching

- Query by lifestyle context, not breed filters
- Foster insights feed (short videos on real in-home behavior)

---

## ScriptHammer template vs RescueDogs product

RescueDogs is a **fork of ScriptHammer** (Next.js, Supabase, Docker, SpecKit).
The template ships many features that are **infrastructure or carryover**, not
part of the five-pillar rescue vision:

| Template area            | RescueDogs product relevance                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| Auth, RLS, PWA, a11y, CI | **Required** — how we build                                                      |
| Messaging, group chats   | **Template carryover** — may support shelter↔adopter later; not in founding MVP |
| Payments / PayPal        | **Template carryover** — not in rescue vision unless a future pillar needs it    |
| Blog, SEO, analytics     | **Template carryover** — marketing/docs surface                                  |
| Geolocation / maps       | **Template carryover** — could support pillar 2 later; no stray workflow today   |

When prioritizing work, ask: **Does this shorten the anti-ghosting loop or prove
it with a real shelter?** If not, it is likely template debt or a future pillar —
not current product scope.

---

## How to use this document

**Adding a feature?** Check pillar status above and Constitution V. Post-MVP
rescue features go through SpecKit (`/specify` → wireframes → `/implement`).

**Onboarding a contributor?** Read this page, then the [constitution](../../.specify/memory/constitution.md)
and the [live demo walkthrough](../../README.md#-live-demo--try-the-loop).

**Revisiting the five pillars?** Only after the current loop is validated in
production with at least one shelter. Each new pillar gets its own SpecKit cycle
and must restate Principle V.

---

## Revision history

| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-07-04 | Initial capture from founding brainstorm + constitution/MVP alignment review |
