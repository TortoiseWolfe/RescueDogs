<!--
Sync Impact Report - v1.0.0 Ratification (Anti-Ghosting Reframe)
Ratification Date: 2026-06-09
Version: (forked from ScriptHammer v1.0.2 constitution, repo v0.3.5,
          commit 89ff7f5) → 1.0.0 (FRESH RATIFICATION)
Project: RescueDogs — pet adoption application tracker

Rationale for fresh v1.0.0 rather than v1.x.x amendment:
  This is a fork from ScriptHammer followed by a wholesale principle
  reframe. The new constitution puts animal-rescue ethics in the top slots
  (I–V) and demotes ScriptHammer's operational disciplines (component
  pattern, TDD, SpecKit+wireframe gate, Docker, progressive enhancement,
  privacy) into a "Mandatory Constraints" section beneath them — the
  structural pattern established by SpokeToWork v1.0.0 and HatCoatAndBoots
  v1.0.0. This is a fresh constitution for a new project, not an amendment
  of the upstream's; semantic versioning starts at 1.0.0 here.

  Note: the pre-ratification contents of this file were ScriptHammer's
  v1.0.2 constitution with "RescueDogs" sed-substituted by scripts/rebrand.sh
  (including a mangled "RN RescueDogs" that upstream calls "RN ScriptHammer").
  This ratification replaces that text wholesale.

Constitutional Alignment at v1.0.0:
  I. No One Gets Ghosted              (the product's reason to exist)
  II. Shelter Staff Time Is Sacred    (the adoption bottleneck is burnout)
  III. Applicant Data Is a Trust      (applications hold sensitive PII)
  IV. The Animal's Outcome Is the Metric  (placements that stick, not DAUs)
  V. One Loop, Proven, Then the Next  (anti-scope-creep; the founding bet)

Inherited family cascade:
  The ScriptHammer v1.0.2 wireframe-gate hardening (workspace decision
  2026-05-02; family forks inherit at their v1.0.0) is carried into the
  SpecKit Workflow constraint below — wireframes are a hard gate between
  /clarify and /plan for all post-MVP features.

Template Consistency (carried forward from ScriptHammer):
  ✅ .specify/templates/plan-template.md            (no change required)
  ✅ .specify/templates/spec-template.md            (no change required)
  ✅ .specify/templates/tasks-template.md           (no change required)
  ✅ .specify/templates/commands/*.md               (no change required)

Family Position:
  RescueDogs is a ScriptHammer family fork (web/Next.js/Docker/SpecKit
  stack — sibling of SpokeToWork, TurtleWolfe, and HatCoatAndBoots). Its
  content domain is animal rescue logistics: the universal adoption
  application, the shelter pipeline dashboard, and the live status tracker.
  See /home/TurtleWolfe/repos/CLAUDE.md for the 5-track family context.

Founding-MVP process note:
  The founding Anti-Ghosting MVP (universal application → shelter dashboard →
  live tracker) was designed and approved as a plan-mode plan
  (~/.claude/plans/innovative-pet-adoption-app-sleepy-hanrahan.md) rather
  than through the full SpecKit progression. That is a documented one-time
  exception; all post-MVP features flow through SpecKit per the Mandatory
  Constraints below.
-->

# RescueDogs Constitution

**Project:** A pet adoption application tracker that ends the #1 failure of
the rescue pipeline: adopters who pour themselves into a five-page
application and never hear back. One universal application, a pipeline
dashboard a volunteer can run, and a Domino's-style status tracker the
applicant can watch. A fork of ScriptHammer (web/Next.js/Docker/SpecKit) —
same machinery, rescue-first reframe.

The five principles below shape what the product does for shelters,
adopters, and animals AND how the codebase is built. The disciplines under
"Mandatory Constraints" are the _how_; the principles above them are the
_why_.

## Core Principles

### I. No One Gets Ghosted

Silence is a failure state. Every application has a visible, truthful,
current status at all times, and every change of status is recorded and
shown to the applicant the moment it happens.

**Forbidden:** dead-end states — an application that can sit indefinitely
with no path forward and no explanation; status changes that happen in the
database but are invisible to the applicant; terminal outcomes (not
selected) that are hidden because they're uncomfortable to deliver.

**Required:** every status mutation writes an auditable history row that
powers the applicant-facing timeline. Rejection is communicated as clearly
as approval — a fast, honest "no" respects the applicant; silence does not.

### II. Shelter Staff Time Is Sacred

The bottleneck in rescue is not love of animals; it is volunteer burnout.
Shelters drown in "what's the status of my application?" emails. This
product exists to give that time back.

**Forbidden:** features that demand staff data entry without returning more
time than they take; workflows that require training a volunteer for more
than five minutes; anything that adds a step to the shelter's day.

**Required:** every feature is weighed against one question — _does this
reduce emails, calls, and clicks for the person running the shelter?_ The
status dropdown must be faster than writing the email it replaces.

### III. Applicant Data Is a Trust, Not an Asset

An adoption application holds a household's private life: home address,
family composition, landlord, veterinarian. People hand it over because
they want to love an animal. That trust is never monetized, profiled, or
leaked.

**Forbidden:** selling or sharing applicant data; shelter staff seeing more
than what the applicant submitted for their pet; any table without RLS;
analytics or tracking before explicit consent.

**Required:** own-row RLS on applicant data; shelter staff see the frozen
application snapshot, never the applicant's live profile; the applicant can
withdraw at any time. Defense in depth: Postgres RLS and SECURITY DEFINER
RPCs are the trust boundary, not the client.

### IV. The Animal's Outcome Is the Metric

Success is a placement that sticks — an animal in a stable home and an
adopter who was treated well enough to come back, foster, or donate.
Success is not engagement, session length, or user counts.

**Forbidden:** gamification that optimizes for app usage over adoption
outcomes; dark patterns that pressure adopters; metrics dashboards that
celebrate traffic while animals wait.

**Required:** product decisions argue from the animal's and adopter's
outcome ("this gets a dog home N days sooner"; "this keeps a rejected
applicant engaged toward the next match") — not from vanity metrics.

### V. One Loop, Proven, Then the Next

The vision is large (fostering pipelines, lifestyle matching, stray-rescue
networks, post-adoption retention). The discipline is small: build ONE loop
end-to-end, prove it with a real shelter, and only then expand. This is the
founding bet of the project and its permanent defense against scope creep.

**Forbidden:** starting pillar N+1 while pillar N is unproven; speculative
schema "for later" that no shipped feature reads; roadmap items leaking
into the current build as "while we're here" additions.

**Required:** the current loop (universal application → pipeline dashboard →
live tracker) reaches a real shelter before any new pillar begins. Each new
pillar gets its own SpecKit cycle and must restate this principle.

## Mandatory Constraints

These are the operational disciplines inherited from ScriptHammer. They are
_how_ we build; principles I–V are _why_. Constraints stay enforced by CI;
violations break the build.

### Docker-First Development

All development happens in containers. Never install packages on the host
(`pnpm install` runs _inside_ the container). Never `sudo` to fix
permissions. The container runs as your user with correct UID/GID. All
commands: `docker compose exec rescuedogs <cmd>`.

### 5-File Component Pattern

Every component MUST ship as five files in its own directory:

```
ComponentName/
  index.tsx                          # barrel export
  ComponentName.tsx                  # the component
  ComponentName.test.tsx             # Vitest unit + RTL component tests
  ComponentName.stories.tsx          # Storybook story
  ComponentName.accessibility.test.tsx  # jest-axe a11y test
```

Generate with `pnpm run generate:component` — never create by hand. CI
(`component-structure.yml`) rejects components missing any of the five.

### Test-First Development

RED → GREEN → REFACTOR. Tests precede implementation. Stack: Vitest (unit +
component), Playwright (E2E), Pa11y (WCAG 2.1 AA, zero violations),
Storybook (every component has a story). Tests run on pre-push via Husky.

### SpecKit Workflow (with the v1.0.2 Wireframe Gate)

All post-MVP features flow through:

```
/specify → /clarify
       → /wireframe.generate → /wireframe.review     [HARD GATE]
       → /plan → /checklist → /tasks
       → /analyze → /implement
       → /wireframe.screenshots                      [post-implement regression]
```

The wireframe gate (inherited from ScriptHammer v1.0.2's family cascade) is
mandatory. Pure-infrastructure PRPs ship a "no UI" wireframe stub rather
than skipping the step. (The founding MVP was built from an approved
plan-mode plan — a documented one-time exception recorded in the Sync
Impact Report above.)

### Route Protection: Client-Side, Not Middleware

Routes that require auth use the `<ProtectedRoute>` client component
(`src/components/auth/ProtectedRoute/`). The Next.js `middleware.ts` pattern
doesn't run with `output: 'export'`. Data security is enforced at the
database layer via Postgres RLS policies and SECURITY DEFINER RPCs, not at
the request layer. Defense in depth — see Principle III.

### Static Hosting

Deploys to GitHub Pages. No server-side API routes. All server logic lives
in Supabase (database, RPCs, triggers, Edge Functions). Dynamic content uses
query-param routing (`?id=`), never dynamic route segments.

### Single Monolithic Migration

One migration file
(`supabase/migrations/20251006_complete_monolithic_setup.sql`) creates the
entire database. Domain tables are appended into it, never split into
separate migration files. RLS on every table, no exceptions.

### Progressive Enhancement + WCAG AA

Core HTML works first. Then PWA (offline support). Then a11y (keyboard nav,
screen reader, color contrast). Then performance (90+ Lighthouse). An
adopter checking their application status from a 6-year-old phone in a
parking lot is the target user.

### Privacy & Compliance First

GDPR-honest by default. Cookie consent before any tracking. Analytics only
after explicit consent. RLS on every Supabase table. No third-party services
without a consent modal. See Principle III — this constraint is its
operational floor, not its ceiling.

## Quality Gates

Every PR / feature ships with all three. CI is configured to fail any of
them.

### Resilient — Graceful Failure

- Every interactive feature has an error boundary.
- Every external dependency has a degraded mode (Supabase Realtime down →
  refetch on focus; Supabase down → honest error state, never a fake
  status).
- A tracker that cannot know the truth says so — it never shows a stale
  status as current (Principle I applied to failure modes).

### Sound — Typed, Tested

- `pnpm tsc --noEmit` zero errors; `pnpm lint` zero errors, zero new
  warnings.
- `pnpm test` (Vitest) green; no regression in overall coverage.
- `pnpm test:e2e` (Playwright) green — including the anti-ghosting loop
  spec.
- `pnpm test:a11y` (Pa11y) zero WCAG AA violations.

### Shipped — Deployable, Grounded

- `pnpm build` static export succeeds.
- CI green; GitHub Pages deploy reachable.
- Lighthouse Performance ≥ 90, Accessibility ≥ 95.

## Governance

### Amendment Procedure

- Amendments use `/speckit.constitution`, which auto-syncs
  `.specify/templates/` and writes a Sync Impact Report at the top of this
  file.
- Each amendment documents rationale, impact analysis, and migration plan
  if breaking.

### Versioning (Semver)

- **MAJOR** — principle removal, redefinition, or governance restructure.
- **MINOR** — principle addition, materially expanded scope.
- **PATCH** — clarifications, wording, typos.

### Compliance & Enforcement

- All PRs verify constitutional compliance — CI enforces the technical
  Mandatory Constraints automatically; reviewers check principle adherence.
- This constitution supersedes all other practices. Sprint constitutions may
  temporarily override for focused work, with documented rationale.
- Use `CLAUDE.md` at the repo root for AI-assistance development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-09 | **Last Amended**: 2026-06-09

## Amendment Log

### v1.0.0 — 2026-06-09 — Ratification

Fresh ratification of a constitution for the RescueDogs project (forked from
ScriptHammer v0.3.5, commit 89ff7f5, rebranded 5251cd1). Five rescue-domain
principles take the Core slots; ScriptHammer's operational disciplines move
into Mandatory Constraints, including the v1.0.2 wireframe-gate family
cascade. Structural pattern mirrors SpokeToWork and HatCoatAndBoots v1.0.0.
The founding Anti-Ghosting MVP proceeds from an approved plan-mode plan as a
documented one-time SpecKit exception.
