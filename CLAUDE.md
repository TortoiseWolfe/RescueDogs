# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Fork Notes (RescueDogs ← ScriptHammer)

RescueDogs is a fork of ScriptHammer (upstream remote configured). The
product is a pet adoption application tracker — universal application →
shelter pipeline dashboard → live applicant status tracker. Constitution:
`.specify/memory/constitution.md` v1.0.0 (rescue-domain principles I–V on
top, ScriptHammer disciplines as Mandatory Constraints).

**After every `git merge upstream/main`, re-run the rebrand and re-check:**

```bash
./scripts/rebrand.sh RescueDogs TortoiseWolfe "Pet adoption application tracker" --preserve-ssh --keep-cname --force
```

- `public/CNAME` **MUST exist** and contain the canonical domain
  `raisedpaws.com`. That file is what points GitHub Pages at the custom
  domain and drops the `/RescueDogs` basePath. Preserve it across
  `git merge upstream/main` and rebrand runs (`--keep-cname`); do **not**
  delete it — removing CNAME silently sends the site back to github.io
  and breaks auth redirects
- `package.json` name must be `rescuedogs` (HatCoatAndBoots' upstream sync
  silently reverted it to the upstream name)
- Do NOT restore `supabase/migrations/999_drop_all_tables.sql` — it sorts
  after the monolithic migration and a naive `supabase db push` would
  create-then-drop every table
- `.specify/memory/constitution.md` is RescueDogs v1.0.0 — never let an
  upstream merge overwrite it

Supabase project: `RescueDogs` ref `cmdhajshektesctrappl` (us-east-2).
Live site: https://raisedpaws.com

## Core Development Principles

1. **Proper Solutions Over Quick Fixes** - Implement correctly the first time
2. **Root Cause Analysis** - Fix underlying issues, not symptoms
3. **Stability Over Speed** - This is a production template
4. **Clean Architecture** - Follow established patterns consistently
5. **No Technical Debt** - Never commit TODOs or workarounds

## Docker-First Development (MANDATORY)

**CRITICAL**: This project REQUIRES Docker. Local pnpm/npm commands are NOT supported.

### NEVER Install Packages Locally

**ABSOLUTELY FORBIDDEN** - Never run these commands on the host machine:

```bash
# ❌ CRITICAL NO - NEVER do any of these locally
npm install
npm install --no-save <package>
pnpm install
pnpm add <package>
yarn install
npx <anything>

# ✅ CORRECT - Always use Docker
docker compose exec rescuedogs pnpm install
docker compose exec rescuedogs pnpm add <package>
```

**Why this is critical:**

- Creates local `node_modules` with wrong permissions (Docker-owned)
- Causes conflicts between host and container dependencies
- Breaks the Docker-first architecture
- Creates cleanup nightmares (Docker-owned files can't be deleted by host user)

**If you accidentally installed locally:**

```bash
docker compose down
docker compose run --rm rescuedogs rm -rf node_modules
docker compose up
```

### NEVER Use sudo - Use Docker Instead

When encountering permission errors, **NEVER use `sudo`**. Use Docker:

```bash
# ❌ WRONG - Don't do this
sudo chown -R $USER:$USER .next
sudo rm -rf node_modules

# ✅ CORRECT - Use Docker
docker compose exec rescuedogs rm -rf .next
docker compose exec rescuedogs rm -rf node_modules
docker compose down && docker compose up
```

**Why**: The container runs as your user (UID/GID from .env). Docker commands execute with correct permissions automatically.

**Permission errors? Always try:**

1. `docker compose down && docker compose up` (restarts container, cleans .next)
2. `docker compose exec rescuedogs pnpm run docker:clean`

### Essential Commands

```bash
# Start development
docker compose up

# Development server
docker compose exec rescuedogs pnpm run dev

# Run tests
docker compose exec rescuedogs pnpm test
docker compose exec rescuedogs pnpm run test:suite    # Full suite

# Storybook
docker compose exec rescuedogs pnpm run storybook

# E2E tests
docker compose exec rescuedogs pnpm exec playwright test

# Type checking & linting
docker compose exec rescuedogs pnpm run type-check
docker compose exec rescuedogs pnpm run lint

# Clean start if issues
docker compose exec rescuedogs pnpm run docker:clean
```

### Git Commits from Docker

Git hooks may fail when running locally if the repo was set up inside Docker. Always commit from inside the container:

```bash
# Configure git identity (add to .env)
GIT_AUTHOR_NAME=Your Name
GIT_AUTHOR_EMAIL=your@email.com

# Commit from container (hooks run correctly)
docker compose exec rescuedogs git add -A
docker compose exec rescuedogs git commit -m "Your commit message"

# Push from host (uses your SSH keys)
git push
```

### Supabase Keep-Alive

Supabase Cloud free tier auto-pauses after 7 days. If paused:

```bash
docker compose exec rescuedogs pnpm run prime
```

## Component Structure (MANDATORY)

Components must follow the 5-file pattern or CI/CD will fail:

```
ComponentName/
├── index.tsx                             # Barrel export
├── ComponentName.tsx                     # Main component
├── ComponentName.test.tsx                # Unit tests (REQUIRED)
├── ComponentName.stories.tsx             # Storybook (REQUIRED)
└── ComponentName.accessibility.test.tsx  # A11y tests (REQUIRED)
```

**Always use the generator:**

```bash
docker compose exec rescuedogs pnpm run generate:component
```

See `docs/CREATING_COMPONENTS.md` for details.

## Architecture Overview

- **Next.js 15** with App Router, static export
- **React 19** with TypeScript strict mode
- **Tailwind CSS 4** + DaisyUI (32 themes)
- **Supabase** - Auth, Database, Storage, Realtime
- **PWA** with Service Worker (offline support)
- **Testing**: Vitest (unit), Playwright (E2E), Pa11y (a11y)

## Static Hosting Constraint

This app is deployed to GitHub Pages (static hosting). This means:

- NO server-side API routes (`src/app/api/` won't work in production)
- NO access to non-NEXT*PUBLIC* environment variables in browser
- All server-side logic must be in Supabase (database, Edge Functions, or triggers)

When implementing features that need secrets:

- Use Supabase Vault for secure storage
- Use Edge Functions for server-side logic
- Or design client-side solutions that don't require secrets

**Example**: The welcome message system uses ECDH shared secret symmetry to encrypt
messages "from" admin without needing admin's password at runtime. The admin's
public key is pre-stored in the database, and `ECDH(user_private, admin_public)`
produces the same shared secret as `ECDH(admin_private, user_public)`.

### Key Paths

```
src/
├── app/           # Next.js pages
├── components/    # Atomic design (subatomic/atomic/molecular/organisms/templates)
├── contexts/      # React contexts (AuthContext, etc.)
├── hooks/         # Custom hooks
├── lib/           # Core libraries
├── services/      # Business logic
└── types/         # TypeScript definitions

tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── contract/      # Contract tests
├── e2e/           # Playwright E2E tests
└── setup.ts       # Vitest setup

docker/            # Docker configuration
├── Dockerfile     # Main Dockerfile
└── docker-compose.e2e.yml  # E2E testing compose

docs/specs/        # Feature specifications (SpecKit artifacts)
tools/templates/   # Component generator templates
```

## PRP/SpecKit Workflow

For features taking >1 day:

1. Write PRP: `docs/prp-docs/<feature>-prp.md`
2. Create branch: `./scripts/prp-to-feature.sh <feature> <number>`
3. Run SpecKit (full 7-step workflow):
   ```
   /specify → /clarify → /plan → /checklist → /tasks → /analyze → /implement
   ```

### SpecKit Commands

| Command      | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `/specify`   | Create feature specification from PRP                |
| `/clarify`   | Ask clarifying questions, encode answers into spec   |
| `/plan`      | Generate implementation plan from spec               |
| `/checklist` | Generate custom checklist for the feature            |
| `/tasks`     | Generate dependency-ordered tasks.md                 |
| `/analyze`   | Cross-artifact consistency check (spec, plan, tasks) |
| `/implement` | Execute the implementation plan                      |

See `docs/prp-docs/SPECKIT-PRP-GUIDE.md` for details.

## Common Issues & Solutions

### Permission Errors

**Always use Docker, never sudo:**

```bash
docker compose down && docker compose up
```

### Slow Supabase (10-30 seconds)

Instance paused after inactivity:

```bash
docker compose exec rescuedogs pnpm run prime
```

### Tailwind CSS Not Loading

1. Don't import Leaflet CSS in `globals.css`
2. Import Leaflet CSS only in map components
3. Restart container after CSS changes

### Port 3000 In Use

```bash
docker compose down
lsof -i :3000
kill -9 <PID>
```

## Test Users

**Primary** (required):

- Email: `test@example.com`
- Password: `TestPassword123!`

**Secondary** (optional - for email verification tests):

- Configure in `.env`: `TEST_USER_SECONDARY_EMAIL`, `TEST_USER_SECONDARY_PASSWORD`

## GitHub Actions Secrets

For CI/CD deployment, add these secrets in **Settings → Secrets and variables → Actions → Repository secrets**:

### Required for Deployment

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Optional but Recommended

```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_PAGESPEED_API_KEY=your-google-api-key
NEXT_PUBLIC_AUTHOR_NAME=Your Name
NEXT_PUBLIC_AUTHOR_EMAIL=your@email.com
```

See `README.md` for the complete list of available secrets.

## Collaboration Conventions

### Issues & PR review comments carry a paste-ready Cursor prompt (HOUSE RULE)

Collaborators (e.g. schlajo) implement fixes in **Cursor** on Windows. Every
issue that asks for a code change, and every PR review that requests changes,
**MUST include a fenced code block the author can paste straight into Cursor's
chat** — not just a prose description of the fix.

**Format:**

- Wrap the prompt in a **four-backtick** fence (` ```` `), not three — the prompt
  itself often contains triple-backtick or nested class strings, and four
  backticks guarantee GitHub renders it as one copyable block with a working
  Copy button.
- Open the prompt with the **context line**: the issue/PR number(s) and the repo
  issue URL, so Cursor's agent can pull the surrounding context.
- Give **exact find/replace targets** pulled byte-for-byte from the PR branch
  (`git show origin/<branch>:<path>`), not paraphrased code — Cursor matches on
  whitespace.
- End with the **in-container verify commands** (`docker compose exec rescuedogs
pnpm run type-check` / `lint`) and a concrete manual check.
- After the fenced block, list **reference links**: the open-source repo URL
  (`https://github.com/TortoiseWolfe/RescueDogs`, MIT), the tracking issue, and
  any upstream docs (Tailwind, DaisyUI, `docs/MOBILE-FIRST.md`, etc.).

**Also:** open a tracking issue for any merge-blocking regression before (or
alongside) the request-changes review, and reference it from both the review and
the Cursor prompt so the fix has a durable target. Reject-and-return uses
GitHub's **`gh pr review <n> --request-changes`** (never push fixup commits to a
collaborator's branch — it erases their authorship).

## Documentation

| Topic               | Location                               |
| ------------------- | -------------------------------------- |
| Authentication      | `docs/AUTH-SETUP.md`                   |
| Messaging System    | `docs/messaging/QUICKSTART.md`         |
| Payment Integration | `docs/features/payment-integration.md` |
| Security            | `docs/project/SECURITY.md`             |
| Mobile-First Design | `docs/MOBILE-FIRST.md`                 |
| Component Creation  | `docs/CREATING_COMPONENTS.md`          |
| Template Setup      | `docs/TEMPLATE-GUIDE.md`               |
| Testing Guide       | `docs/project/TESTING.md`              |
| Forking Guide       | `docs/FORKING.md`                      |

## Supabase Database Migrations (CRITICAL)

**NEVER create separate migration files.** This project uses a **monolithic migration file**:

```
supabase/migrations/20251006_complete_monolithic_setup.sql
```

### Adding Schema Changes

1. **Edit the monolithic file directly** - Add new tables, columns, indexes to the appropriate section
2. **Use `IF NOT EXISTS`** - All CREATE statements must be idempotent
3. **Add to existing transaction** - New schema goes inside the `BEGIN;`...`COMMIT;` block
4. **Execute via Supabase Management API** - Use `SUPABASE_ACCESS_TOKEN` from `.env`

### Executing Migrations (Claude Code)

**NEVER tell the user to run migrations manually.** Use the Supabase Management API:

```bash
# Check for access token in .env
SUPABASE_ACCESS_TOKEN=<token>
NEXT_PUBLIC_SUPABASE_PROJECT_REF=<project-ref>

# Execute SQL via Management API
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

**DO NOT:**

- Tell user to copy SQL to dashboard manually
- Install database clients locally (pg, psql, etc.)
- Try direct database connections from Docker (DNS issues)

### Example: Adding a Column

```sql
-- Add to the appropriate table section in the monolithic file
ALTER TABLE user_encryption_keys
ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
```

### Why Monolithic?

- Single source of truth for entire schema
- Can recreate database from scratch with one file
- No migration ordering issues
- Supabase Cloud doesn't support CLI migrations on free tier

**DO NOT:**

- Create files like `032_add_encryption_salt.sql`
- Suggest running SQL snippets piecemeal
- Use Supabase CLI migrations

## CI & E2E Stability (Round 10 Lessons, 2026-05-13)

The E2E suite ran against a single shared Supabase project for months and accumulated **9 rounds of "flake mitigation"** that all attacked symptoms. Round 10 (PR #89, commit `996211e`) finally identified the underlying root cause and fixed it structurally. These rules exist so future contributors don't re-derive the same painful path.

### NEVER merge a PR while another PR's CI is running against the same backend

**Why**: this is what caused issue #85 to compound. Two concurrent E2E runs against the same Supabase project race each other's `cleanupOldMessages` `beforeAll` hooks across 11+ messaging specs. Each run wipes data the other run is polling for. One run hits the 60-min GitHub Actions job cap and gets cancelled.

**Now protected by**: `.github/workflows/e2e.yml` has a repo-wide `concurrency:` mutex (`group: e2e-supabase-${{ github.repository }}`, `cancel-in-progress: false`). Concurrent E2E runs queue; they never race. But the rule still applies to other shared backends in the future.

**Verification it's active**: trigger two pushes within 1 minute; the second workflow shows "Queued, waiting for another workflow run" in the Actions UI.

### NEVER bypass commit hooks (no `--no-verify`)

**Why**: husky + lint-staged + gitleaks all run pre-commit and catch real bugs. Yesterday's session almost shipped secrets in a doc PR; gitleaks caught it. The user explicitly forbids `--no-verify` unless they ask for it.

**If a hook fails**: investigate. Hook output names the file + line. Fix the underlying issue, re-stage, commit. Never `git commit --no-verify` as an escape hatch.

### Programmatic `el.scrollTop = N` does NOT fire scroll events reliably in WebKit

**Why this matters**: Chromium and Firefox auto-fire the `scroll` event when JavaScript assigns to `scrollTop`. WebKit (Playwright's Linux build) does not always do this. Yesterday's `messaging-scroll.spec.ts:261` test ("T007-T008: Jump button appears when scrolled") failed all 3 retries on webkit-msg because the React `handleScroll` listener at `src/components/molecular/MessageThread/MessageThread.tsx:194` never ran.

**The fix pattern** (now applied at 4 sites in `tests/e2e/messaging/`):

```typescript
await el.evaluate((el) => {
  el.scrollTop = N;
  el.dispatchEvent(new Event('scroll', { bubbles: true })); // <-- explicit dispatch for WebKit
});
```

Apply this any time test code sets `scrollTop` and expects a scroll-event-driven UI side effect.

### WebKit does NOT move focus to links/buttons on `Tab`

**Why this matters**: Safari/WebKit only tabs to links and buttons when macOS "Full Keyboard Access" is enabled — off by default — and Playwright's WebKit build inherits that default. Chromium and Firefox tab to every focusable element. So this:

```typescript
await page.keyboard.press('Tab');
await expect(page.locator(':focus').first()).toBeVisible(); // times out on WebKit ONLY
```

fails on the webkit shard alone, and reads like an accessibility defect in the page when it is really a browser behaviour difference. It kept `webkit-msg-iso` red on `main` (#154) — worse than it sounds, because a permanently-red job trains everyone to ignore that shard, which is exactly how #126 hid behind 3 "flaky" tests for weeks.

**The fix pattern**: guard the Tab-traversal step by browser, keep every other assertion running.

```typescript
test('...', async ({ browser, browserName }) => {
  if (browserName !== 'webkit') {
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus').first()).toBeVisible();
  }
  // remaining WCAG assertions still run on every browser
});
```

Prefer this over `test.skip(browserName === 'webkit')`, which aborts the whole test and silently drops the other assertions on WebKit.

### Branch hygiene — NON-NEGOTIABLE

- **`delete_branch_on_merge=true`** is set on the repo. Every merged PR auto-deletes its head branch. Don't undo this.
- **After merging**, always `git fetch --prune origin` to drop the dead remote-tracking ref locally.
- **Never leave unmerged branches or open PRs sitting around** between work items. Merge or close one before starting the next.
- **Avoid stacked PRs** unless dependency is unavoidable. When a parent PR merges with `delete_branch_on_merge=true`, GitHub auto-closes any child PR using that parent as its base (known footgun — happened to PR #87 yesterday). Re-target the child to `main` and reopen.

### CI logs API ≠ UI

- **Authoritative state**: `gh run view <id> --json status,conclusion,jobs` or REST API
- **UI is misleading**: the workflow-run-list page shows the workflow's _overall_ status with the most-recent activity timestamp. That timestamp is when the _last queued sub-job started_, not when the run as a whole started. Reading "In progress 10:35 PM" as "nothing started yet" is wrong but easy to do.
- **For per-job status**: click into the run itself (job-graph view) or use the API. Don't trust the list page.

### `gh variable` / `gh secret` need an explicit `--repo` — they read ScriptHammer otherwise

This repo is a fork with an `upstream` remote pointing at `TortoiseWolfe/ScriptHammer`. `gh repo set-default` was run here, so `gh repo view`, `gh issue list`, `gh run list`, and `gh pr list` all correctly resolve to RescueDogs — **but `gh variable list` and `gh secret list` still read the parent repo.**

```bash
# ❌ WRONG - silently returns ScriptHammer's config
gh variable list
gh secret list

# ✅ CORRECT
gh variable list --repo TortoiseWolfe/RescueDogs
gh secret list --repo TortoiseWolfe/RescueDogs
```

**Why this matters**: on 2026-08-15 the bare form returned `NEXT_PUBLIC_DEPLOY_URL = https://scripthammer.com` and a `SUPABASE_PROJECT_REF` that does not exist in this repo. That output is what manufactured issue #156 ("three different Supabase project refs"), which was closed as not-a-bug once the same commands were re-run with `--repo`. RescueDogs has exactly one ref, `cmdhajshektesctrappl`, and local `.env`, the CI variable, and both anon-key JWTs agree on it.

**Smell test for output stolen from upstream**: a timestamp that predates the June 2026 fork, a `scripthammer.com` value, or a key name you don't recognise from this repo. Any one of those means you're reading the wrong repository — re-run with `--repo` before acting on it.

### gh 2.46.0 is broken for `issue view` / `pr view` / `pr edit` — use `--json` or `gh api`

The installed CLI is **gh 2.46.0**, which still requests `repository.issue.projectCards`. GitHub sunset Projects (classic), so these all exit 1 printing only a GraphQL deprecation error and **no content**:

```bash
gh issue view 5                    # ✗ exits 1, prints nothing
gh issue view 5 --comments         # ✗ same
gh pr view 202                     # ✗ same
gh pr edit 202 --add-reviewer foo  # ✗ same — and the reviewer is NOT added
```

The failure is easy to misread as "the issue doesn't exist" or "gh isn't authenticated". It is neither.

**What works:**

```bash
# reading — the --json projection avoids the broken field
gh issue view 5 --repo TortoiseWolfe/RescueDogs --json body,comments \
  --jq '.body, "\n=== LATEST COMMENT ===\n", .comments[-1].body'

# writing — go straight to REST
gh api -X POST repos/TortoiseWolfe/RescueDogs/pulls/202/requested_reviewers \
  -f 'reviewers[]=schlajo'
```

`gh issue comment`, `gh pr comment`, `gh pr create`, `gh issue create`, `gh pr merge`, `gh run *` and `gh api` are all unaffected.

Note `gh pr edit` fails **silently in the worst way**: it prints the GraphQL error but the surrounding shell often keeps going, so a reviewer request or label edit can look done when nothing happened. Verify writes:

```bash
gh api repos/TortoiseWolfe/RescueDogs/pulls/202 \
  --jq '[.requested_reviewers[].login]'
```

### The contrast gate is WCAG **AAA (7:1)**, not AA

`tests/e2e/color-contrast.spec.ts` runs axe's **`color-contrast-enhanced`** rule — AAA — against `/`, `/themes/`, `/accessibility/`, `/status/` in both themes. That was a deliberate choice (#21 / #81). AA's 4.5:1 is **not** the bar here.

This is easy to get wrong and expensive when you do: #190 was written citing "the 4.5:1 WCAG AA threshold", the fix landed at 6.31:1, and it failed `chromium-gen 2/6` on both themes. The correction (#204) darkened `--color-accent-content` / `--color-secondary-content` from `#0c1929` to `#040c14` — 7.02:1 on the `#f97316` fill.

Two things worth carrying forward:

- **`#f97316` cannot reach AAA with any text colour.** The ceiling is 7.49:1 with pure black. If a surface needs orange, the _fill_ has to change, not just the text.
- **A contrast "fix" can convert a hidden failure into a visible one.** White-on-orange was always 2.80:1, but axe reported those nodes `incomplete` (it couldn't resolve a colour through the hero's `bg-gradient-to-b` ancestor), so CI never counted them. Making the colour deterministic is what turned a real, shipped defect into a measurable violation. A newly-red contrast test may mean you _exposed_ a bug, not caused one.

Only those four pages are gated. `/contact` and `/follow` have no automated contrast check at all — verify those by measuring computed styles in a browser, not by trusting a green suite.

### `pnpm run format` rewrites the **entire repo**, not your changes

The repo is not prettier-clean, so `pnpm run format` touches everything it can reach. One run during #190 produced **74 changed files / 2363 insertions**, including `.github/workflows/e2e.yml`, `public/sw.js`, and a 3847-line wireframe viewer — none of them related to the change.

Format the files you actually touched:

```bash
docker compose exec rescuedogs pnpm exec prettier --write <paths>
# or just verify, since lint-staged formats on commit anyway:
docker compose exec rescuedogs pnpm exec prettier --check <paths>
```

If you already ran the repo-wide version, revert everything outside your scope before committing — a 28-line fix buried in a 2000-line diff is unreviewable.

### E2E cannot run locally at all without `SUPABASE_SERVICE_ROLE_KEY`

`tests/e2e/global-setup.ts:28-49` hard-requires five env vars and aborts the whole run if any is missing. That gate is unconditional: it fires even for specs that never touch Supabase, so you cannot run a homepage-only test locally without the service-role key. That key is in schlajo's Supabase account — see **#6**.

Practical consequence: for local verification, prove the behaviour another way rather than assuming the suite will tell you. Both of these worked well on #189/#190:

- Run the pure function directly (`pnpm exec tsx`) over many iterations to measure a probability claim.
- Drive the dev server and read computed styles / DOM state in a browser.

Also note `CI` is set inside the container, so Playwright takes the `reuseExistingServer: false` branch and will refuse to start against a running dev server. Use `SKIP_WEBSERVER=1` when a server is already up.

### A green E2E job can still be hiding a flake

Only `*-msg-iso` sets `--fail-on-flaky-tests`. The `-gen` shards leave `FAIL_ON_FLAKY` empty, so a test that fails then passes on retry reports as **`1 flaky, 42 passed`** and the job goes green.

Observed live on 2026-08-15: #189 hard-failed `main` on `chromium-gen 5/6` (all 3 attempts), then flaked silently green on the very next PR run. Read the flaky count in the job log, not just the conclusion — this is the #126 blind spot in a different shard.

### `mergeStateStatus: CLEAN` is **not** a signal that E2E ran

`main` now has branch protection: required checks **`Test (20.x)`** and **`accessibility`** (the raw check-run names — the `Workflow / job` display form does not match and would block every PR), `strict: false`, `enforce_admins: true`, no review requirement, force-pushes and deletions disabled.

**E2E is deliberately NOT a required check.** `e2e.yml` is the only workflow with `paths-ignore`, so a docs-only PR never reports an E2E context — making it required would render such PRs permanently unmergeable. (`Test Report` is also unsuitable: it is a summary job with no `needs.*.result` gate, so it can go green while shards are red.)

The consequence to internalise: because E2E is not required, a PR whose E2E is still `pending` reports `mergeable=MERGEABLE, mergeStateStatus=CLEAN` — the E2E context is simply **absent from `statusCheckRollup`**. Verify the E2E _run's own status_ before merging; `CLEAN` only means "no required check is failing".

Making E2E genuinely requirable needs a gate job that checks `needs.*.result` plus converting `paths-ignore` into per-job conditions (skipped jobs satisfy required checks). Not done yet.

### Check for an existing PR before starting a ticket

Two collaborators on a small ticket queue means a ticket can be finished between the moment it is filed and the moment someone picks it up. #180 was filed, escalated, and already had an open PR (#182) within the hour; #193 and #195 were both implemented by schlajo after being reassigned.

```bash
gh pr list --repo TortoiseWolfe/RescueDogs --state open
git ls-remote --heads origin
```

Also: a PR title containing `(#NNN)` does **not** close the issue — only a `Closes #NNN` keyword in the body does. #193 sat open and looked like unstarted work for hours after it had shipped.

## Important Notes

- Never create components manually - use the generator
- All PRs must pass component structure validation
- **E2E tests DO run in CI** — **24 shards** on a push to `main` (8 per browser: 1 msg + 1 msg-iso + 6 gen, across chromium/firefox/webkit). A **pull request runs chromium only (8 shards)** unless it carries the `full-e2e` label. See "CI & E2E Stability" above
- Docker-first development is mandatory
- Use `min-h-11 min-w-11` for 44px touch targets (mobile-first)

---

## Planning Factory (Multi-Terminal Workflow)

This repo also contains the planning factory tooling from the RescueDogs planning template. The sections below govern the multi-terminal spec-driven workflow.

### Multi-Terminal Assembly Line

Claude Code terminals in a tmux session arranged in assembly line order:

```
STRATEGY:    CTO → ProductOwner → BusinessAnalyst
DESIGN:      Architect → UXDesigner → UIDesigner
CODE:        Developer → Toolsmith → Security
TEST:        TestEngineer → QALead → Auditor
DOCS:        Author → TechWriter
RELEASE:     DevOps → DockerCaptain → ReleaseManager → Coordinator
```

Wireframe work has been consolidated onto the SpecKit `/speckit.wireframe.*`
skills — the dedicated 6-role wireframe tmux pipeline was retired and
absorbed into the Developer / UIDesigner terminals' normal workflow.

See `.claude/roles/` for role-specific context:

| File                | Roles                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `operator.md`       | Operator (runs outside tmux)                                          |
| `council.md`        | CTO, ProductOwner, Architect, UXDesigner, Toolsmith, Security, DevOps |
| `design.md`         | UIDesigner                                                            |
| `implementation.md` | Developer, TestEngineer, QALead, Auditor                              |
| `support.md`        | Author, TechWriter, BusinessAnalyst, Coordinator                      |
| `release.md`        | DevOps, DockerCaptain, ReleaseManager                                 |
| `stw-liaison.md`    | StW-Liaison (client operator for SpokeToWork)                         |

### Terminal Git Rules

When operating as a terminal in the multi-terminal workflow:

- **COMMIT ONLY, NEVER PUSH** — Only the Operator has SSH access to push
- Stay in your lane: commit your work and move on

### Feature Specs & Wireframes

- `features/<category>/<NNN-name>/` — feature specifications (spec.md, plan.md, tasks.md, checklist.md) + per-feature `wireframes/` subdir with SVGs and shared chrome
- `features/IMPLEMENTATION_ORDER.md` — dependency graph + tier ordering
- `.claude/inventories/` — codebase inventory snapshots (run `/refresh-inventories` after spec changes)
- `/wireframes` Next.js route iframes the manifest-driven viewer (auto-discovers all SVGs; build-synced by `scripts/sync-wireframes.sh`)

### SVG Wireframe Rules

- Canvas: `viewBox="0 0 1920 1080" width="1920" height="1080"`
- Desktop: x=40, y=60, 1280×720 | Mobile: x=1360, y=60, 360×720
- Panel color: `#e8d4b8` (never white)
- Touch targets: 44px minimum
- Machine validation: `.specify/extensions/wireframe/scripts/validate.py`

### Fork Guide

After forking RescueDogs:

1. Run `/refresh-inventories` — Regenerates context files for your specs
2. Update `.claude/inventories/` — Reflects your project's features
3. Modify `features/IMPLEMENTATION_ORDER.md` — Your dependency sequence
