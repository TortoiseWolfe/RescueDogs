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

## How we refer to Raised Paws

The consumer-facing brand is **Raised Paws**. The repo/project name remains
`RescueDogs` for GitHub and tooling.

| Audience / context            | Prefer                                                                 | Avoid as the primary label                             |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Adopters, social, short title | **Pet adoption application tracker** or **pet adoption tracker**       | “Pet rescue and adoption app”                          |
| Shelters, grants, tech lead   | **Anti-ghosting adoption platform** (or OS) for shelters               | “Petfinder alternative” / browse directory             |
| One-line product honesty      | Apply once → shelter pipeline → **live status** so nobody gets ghosted | Vague “we help rescue animals” without naming the loop |

**Why “tracker” over “rescue app”:** a “pet rescue and adoption app” sounds like a
listing marketplace (Petfinder-class). Today’s shipped product is the **application
status loop** — that is the wedge. Broader rescue-ecosystem language fits later
pillars and future horizons; it is not the accurate label for what people can
use on [raisedpaws.com](https://raisedpaws.com) right now.

**Draft lines to reuse:**

- Adopters: _Raised Paws — track your pet adoption application so you’re never ghosted._
- Shelters: _Raised Paws — the anti-ghosting adoption platform: one application, a simple pipeline, live status for applicants._

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

## Shelter onboarding and application strategy

One of the hardest adoption problems is not building the loop — it is getting
real shelters to use it without asking them to replace everything they already
have. This section captures the go-to-market strategy for pillar 3: what we ask
shelters to change, what we do not ask, and how pet data and applications fit
together.

### What we are not trying to do

- **Not Petfinder.** We do not need to become the national pet photo directory
  or manually upload every shelter's animals nationwide.
- **Not rip-and-replace on day one.** Many shelters have county contracts,
  insurance waivers, or board-approved PDFs they cannot abandon immediately.
- **Not duplicate data entry forever.** Manual import is a pilot tactic, not the
  long-term operating model.

The wedge is narrower and stronger:

> Shelters can keep listing pets wherever they already do. Use RescueDogs so
> applicants stop getting ghosted.

### How pet information gets into the system

The shipped MVP seeds pets and shelters for demo (`048-rescue-mvp`). Real shelter
onboarding is future work, planned in phases:

| Phase                     | How pets enter                                                                 | Who does the work                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Pilots (1–5 shelters)** | Spreadsheet import, Petfinder export, or copy from the shelter's existing site | RescueDogs + shelter during paid onboarding (see [BUSINESS-MODEL.md](./BUSINESS-MODEL.md)) |
| **Growth**                | Simple shelter self-service: add and edit currently available pets             | Shelter staff                                                                              |
| **Scale**                 | Sync with Petfinder, shelter management software, or website feeds             | Paid integrations (Tier B in business model)                                               |

For early pilots, a shelter may only need **currently available** animals in the
system — often 10–30 pets, not their full historical catalog. Listing
elsewhere (Petfinder, website, social) can continue; our apply link and pipeline
are the product entry point.

### Data integrations (what we are not building)

We are **not** planning a universal scraper or an extractor that pulls
everything from every shelter database. Early pilots use a **one-time import**
of currently available pets (spreadsheet, Petfinder export, or copy from their
site). Shelters can keep listing animals on Petfinder or their own website.

Over time we add **self-service pet management** in Raised Paws, then
**targeted official integrations** (Petfinder, shelter management software such
as PetPoint or Shelterluv, website feeds) — built **one system at a time** through
APIs and partnerships, not unauthorized scraping.

We do **not** need to mirror a shelter's full historical animal database — only
the pets they are actively taking applications for. For **applications**, Raised
Paws is the system of record for new intake and live status; we do not pull old
applications out of their existing systems. Supplemental shelter PDFs or forms
can remain, but status tracking lives in our pipeline.

### Universal application vs shelter-specific forms

Shelters often already have their own applications. That is expected. RescueDogs
does not need to win a fight over every legal document in year one. What must
not break is the anti-ghosting loop: **status must live in RescueDogs.**

| Principle                             | Implication                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- |
| **I — No One Gets Ghosted**           | Pipeline and live tracker require applications to flow through our system   |
| **II — Shelter Staff Time Is Sacred** | Adopters fill core data once; staff should not re-type the same answers     |
| **III — Applicant Data Is a Trust**   | Frozen application snapshot for shelter review; no selling or profiling PII |

**Raised Paws universal application = system of record** for intake, pipeline,
and status. Their forms, when still required, are supplementary — not where
status dies in an inbox.

### Three patterns (per shelter)

| Pattern                             | When to use                                  | Adopter experience                                                                                        |
| ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **A — RescueDogs only**             | Small rescue with a flexible process         | One form → full tracker                                                                                   |
| **B — RescueDogs + export**         | Shelter keeps a PDF or Google Form for files | Fill once on RescueDogs; shelter receives export or adopter copies fields into their form                 |
| **C — RescueDogs + shelter packet** | Legally required external form               | Step 1: RescueDogs (status starts). Step 2: link to their form. Staff marks "packet received" in pipeline |

Do **not** host random shelter application iframes as the primary apply flow —
inconsistent hosts, no reliable data capture, and status still disappears into
their inbox. Do allow a **link or checklist step** in the pipeline while status
remains in RescueDogs.

Pre-fill is the bridge between "apply once" and shelter reality. The shipped
form already supports profile prefill; future work includes PDF export, copy for
external web forms, and integrations with shelter management tools.

### The pilot ask (simple and concrete)

1. Import **currently available** pets (spreadsheet, export, or manual one-time setup).
2. Send applicants to the **RescueDogs apply link** for those pets.
3. Staff run **status updates in the pipeline** — even if they still file a
   separate county PDF offline.

**What we sell:** fewer "what's my status?" emails, one dashboard to advance
applications, adopters who stay engaged because updates are visible.

**What we do not sell yet:** replacing Petfinder, replacing every legal adoption
document, or re-keying an entire animal database by hand.

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

## Future horizons (possible additions after pillars 1–5)

These ideas extend the original vision but are **not approved pillars, roadmap
commitments, or current scope**. Revisit them only after pillar 3 is proven and
the original deferred pillars have been evaluated in sequence. Each horizon
requires customer discovery, partner validation, legal/privacy review, and its
own SpecKit cycle before implementation.

### Horizon A — Human–animal wellness network

Bring animal-assisted wellness organizations onto the platform, including
equine grooming and care programs for people experiencing PTSD or anxiety,
therapeutic riding programs, and other qualified organizations that facilitate
structured human–animal interaction.

**Why it could matter:**

- Expands the ecosystem beyond adoption while remaining connected to animal
  welfare and community support
- Helps specialized organizations become discoverable without requiring them to
  operate a shelter or list animals for adoption
- Could complement pillar 4 by connecting adopters to appropriate post-adoption
  behavioral, grooming, or wellness support

**Risks and questions to resolve:**

- Distinguish clinical therapy, non-clinical wellness, grooming, and recreational
  programs accurately; do not imply that RescueDogs provides medical treatment
- Verify credentials, animal-welfare standards, insurance, and safeguarding
  practices without presenting a listing as an endorsement
- Avoid collecting diagnoses or sensitive mental-health intake data. An initial
  version should favor verified organization profiles and external referrals
  over clinical scheduling or patient records
- Validate that participation benefits the animals as well as the people

### Horizon B — Microchip identity and reunion network

Reduce the fragmented lookup process faced by veterinarians, shelters, and
people who find lost pets. A scanned chip number could be routed to the correct
participating registry from one workflow instead of requiring calls or searches
across multiple databases.

**Why it could matter:**

- Creates a direct path from pillar 2's stray response workflow to safe reunion
- Supports shelter intake and pillar 4's post-adoption lifecycle
- Solves a concrete coordination problem without requiring RescueDogs to become
  the owner of every registry's records

**Risks and questions to resolve:**

- Treat this as a standards, partnership, and API effort—not unauthorized
  scraping or a promise that every registry can be searched
- Existing universal lookup services may already cover part of the problem;
  identify the remaining gaps before building
- Prefer a privacy-preserving lookup router that identifies the responsible
  registry or relays contact, rather than exposing owner information
- Establish authorization rules for veterinarians, shelters, animal-control
  agencies, and members of the public; log and audit sensitive lookups
- Require formal agreements with registries and a security review before
  handling chip-linked identity data

### Horizon C — Federated animal-services hub

Connect shelters, rescues, foster groups, stray-response volunteers,
veterinarians, low-cost clinics, trainers, groomers, animal-assisted wellness
programs, microchip registries, and other mission-aligned organizations through
one trusted entry point.

This should be a **federated service network**, not a generic pet-business
directory. Organizations should participate because they complete a meaningful
animal-care workflow—adoption, reunion, fostering, treatment, training, or
retention—not merely because they want a listing.

**Why it could matter:**

- Gives people a coherent path through services that are currently fragmented
- Lets each completed pillar become a connected part of a larger ecosystem
- Creates shared referral and outcome data that can reduce dead ends between
  organizations

**Risks and questions to resolve:**

- A broad directory launched too early would dilute the anti-ghosting
  positioning and compete on listing volume rather than outcomes
- Profiles require verification, moderation, freshness checks, category
  standards, dispute handling, and a clear removal process
- Paid placement must never determine welfare recommendations or obscure why an
  organization appears in results
- Geographic coverage should expand only where listings and referrals can be
  kept trustworthy and useful

### Long-term narrative and sequencing

The possible arc is:

1. **Finish adoptions** — prove the anti-ghosting shelter loop
2. **Support the animal's journey** — foster, stray response, retention, and
   lifestyle fit through pillars 1–5
3. **Reunite and connect** — microchip routing and qualified wellness partners
4. **Federate the ecosystem** — become a trusted front door to animal services
   without becoming an advertising-driven directory

The long-term promise is not "every pet organization in one app" by itself. It
is **one trusted place to finish adoptions, reunite lost animals, and find the
organizations that keep animals and their people supported**.

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

| Date       | Change                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 2026-07-13 | Added “How we refer to Raised Paws” (tracker vs rescue-app naming)                                     |
| 2026-07-12 | Added data-integration guardrails under shelter onboarding; clarified no universal DB extractor        |
| 2026-07-12 | Added shelter onboarding and application strategy for pillar 3 pilots                                  |
| 2026-07-11 | Added post-pillar future horizons for wellness, microchip reunion, and a federated animal-services hub |
| 2026-07-04 | Initial capture from founding brainstorm + constitution/MVP alignment review                           |
