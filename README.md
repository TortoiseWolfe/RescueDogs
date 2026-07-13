# RescueDogs — the Anti-Ghosting Adoption Tracker

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/TortoiseWolfe/RescueDogs)
[![Stars](https://img.shields.io/github/stars/TortoiseWolfe/RescueDogs?style=social)](https://github.com/TortoiseWolfe/RescueDogs)

Adopters pour themselves into a five-page adoption application and never hear
back. RescueDogs ends that: **one universal application, a pipeline dashboard
a shelter volunteer can run, and a Domino's-style status tracker the
applicant watches update live.** Built on the ScriptHammer template
(Next.js 15 / React 19 / Supabase / DaisyUI, static export to GitHub Pages).

Constitution: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
— Principle I: _No One Gets Ghosted._

## 🚀 Live Demo — Try the Loop

Everything runs against a seeded demo shelter (**Second Chance Rescue**) with
two demo accounts. **Sign in first** — these pages are gated, and `/shelter`
bounces non-staff accounts back to the home page (that's the gate working).

**Sign in:** <https://raisedpaws.com/sign-in/>

| Role                | Email               | Password       |
| ------------------- | ------------------- | -------------- |
| Adopter (Dana)      | `adopter@demo.test` | `DemoPass123!` |
| Shelter staff (Sam) | `staff@demo.test`   | `DemoPass123!` |

> Demo-only credentials, published on purpose. The seeded data lives in
> [`supabase/seed-rescue-demo.sql`](supabase/seed-rescue-demo.sql).

### Adopter pages (sign in as `adopter@demo.test`)

- **Apply to adopt** (prefilled from the saved universal application):
  <https://raisedpaws.com/adopt/>
- **My applications** (Biscuit submitted, Pepper in reference check, Tank not selected):
  <https://raisedpaws.com/applications/>
- **Live status tracker** for Pepper:
  <https://raisedpaws.com/applications/status/?id=55555555-5555-5555-5555-555555555502>

### Shelter staff pages (sign in as `staff@demo.test`)

- **Pipeline dashboard** (filter tabs + counts):
  <https://raisedpaws.com/shelter/>
- **Review Biscuit** (Submitted — advance it!):
  <https://raisedpaws.com/shelter/application/?id=55555555-5555-5555-5555-555555555501>
- **Review Pepper** (Reference Check):
  <https://raisedpaws.com/shelter/application/?id=55555555-5555-5555-5555-555555555502>
- **Review Tank** (Not Selected — terminal, no further actions):
  <https://raisedpaws.com/shelter/application/?id=55555555-5555-5555-5555-555555555503>

### The two-window demo (the whole point)

1. Window 1: sign in as **staff** → open Biscuit's review page.
2. Window 2 (incognito / second profile): sign in as the **adopter** → open
   Biscuit's tracker at
   `https://raisedpaws.com/applications/status/?id=55555555-5555-5555-5555-555555555501`.
3. In window 1, set the status to _Under Review_ and add a note.
4. Watch window 2: the tracker advances and the note appears — **no reload**.
   That's the anti-ghosting loop (Supabase Realtime + RLS-scoped events).

The Shelter nav link only appears for staff accounts; adopters never see it.

> **Joining the team?** Start with [CONTRIBUTING.md](./CONTRIBUTING.md) — SSH
> key setup, cloning, `.env`, and the Docker-first workflow, step by step.

## ✨ Key Features

- 🎨 **32 DaisyUI Themes** - Light/dark variants with persistent selection
- 📱 **Progressive Web App** - Installable with offline support
- 🧩 **Component Library** - Atomic design with Storybook documentation
- ♿ **Accessibility** - WCAG AA compliant, colorblind assistance
- 🔒 **Privacy Compliance** - GDPR-ready cookie consent system
- 🧪 **Testing Suite** - Comprehensive unit tests with 58% coverage, E2E test suite, accessibility testing
- 📊 **Real-time Monitoring** - Web Vitals, Lighthouse scores, health checks
- 🚀 **CI/CD Pipeline** - GitHub Actions with automated deployment

## 🛠️ Tech Stack

- **Next.js 15.5** / **React 19** / **TypeScript 5**
- **Tailwind CSS 4** + **DaisyUI** (beta)
- **Vitest** / **Playwright** / **Pa11y**
- **Docker** / **GitHub Actions** / **pnpm 10.16.1**

## 🚀 Quick Start

> 💡 **New to RescueDogs?** Start at [`docs/FORK-CHECKLIST.md`](./docs/FORK-CHECKLIST.md) for the complete service-setup matrix — which env vars to set, which services are required vs. optional, where to sign up for each, and the suggested setup order. The Quick Start below is just the bare minimum to boot the dev server.

### Prerequisites

- Docker and Docker Compose installed
- Git configured

### Docker Development (MANDATORY)

This project **REQUIRES Docker** for development to ensure consistency across all environments.

```bash
# 1. Use this template on GitHub (your project name is auto-detected!)
# 2. Clone YOUR new repository
git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git
cd YOUR_PROJECT_NAME

# 3. Create and configure .env file (REQUIRED)
cp .env.example .env

# Edit .env to add your services (all optional except UID/GID):
# - Google Analytics ID
# - EmailJS/Web3Forms credentials
# - Calendar integration URLs
# - Author information
# See .env.example for all available options

# 4. Start Docker development environment
docker compose up     # Start everything (first build takes 5-10 minutes)

# Development is now running at http://localhost:3000
```

### Common Docker Commands

```bash
# Run commands inside container
docker compose exec rescuedogs pnpm run dev         # Dev server
docker compose exec rescuedogs pnpm test            # Run tests
docker compose exec rescuedogs pnpm run storybook   # Storybook

# Clean restart if needed
docker compose down
docker compose up --build
```

**NOTE**: Local pnpm/npm commands are NOT supported. All development MUST use Docker.

## 💳 Payment Integration Setup

**Heads-up for forkers**: Payment integration (Stripe one-time + PayPal subscriptions + GDPR consent flow) is **built into this template** but is **NOT activated out of the box**. No API keys are committed — you must create your own accounts and configure them before `/payment-demo` will work against live sandbox APIs.

**Security — where keys go**:

- **`.env.example`** is committed to git. NEVER put real values here. Only placeholders.
- **`.env`** is gitignored. Safe for `NEXT_PUBLIC_*` public keys (e.g. Stripe publishable key, PayPal client ID — these ship in the client bundle by design).
- **Supabase Vault** is where server secrets live (Stripe secret + webhook secret, PayPal secret + webhook ID). This is a static export to GitHub Pages — there's no Next.js server runtime, so anything without a `NEXT_PUBLIC_` prefix in `.env` is unused. Server secrets are only readable by Supabase Edge Functions via `Deno.env.get(...)`.

**Quick setup** (~30-60 minutes of external account work):

1. **Stripe** — create an account at [dashboard.stripe.com](https://dashboard.stripe.com), grab **test-mode** publishable key (`pk_test_...`) and secret key (`sk_test_...`) from Developers → API keys. Set up a webhook endpoint pointing to your Supabase `stripe-webhook` Edge Function URL and copy the signing secret (`whsec_...`).
2. **PayPal** — create a sandbox app at [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Sandbox → Create App. Grab client ID and secret. Create a sandbox webhook and copy its webhook ID.
3. **Populate the two places**:
   - Public keys (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`) → `.env`
   - Server secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) → Supabase Vault via `supabase secrets set` or the Supabase dashboard → Project Settings → Edge Functions → Secrets
4. **Test** — Stripe test card `4242 4242 4242 4242`, PayPal sandbox buyer accounts. No real money moves in test/sandbox mode.

Once configured, `/payment-demo` should work end-to-end against sandbox APIs. The payment E2E test stubs (~47 skipped tests under `tests/e2e/payment/`) can then be un-skipped as each dependent feature is implemented.

**Full deployment guide**: [docs/PAYMENT-DEPLOYMENT.md](./docs/PAYMENT-DEPLOYMENT.md) covers the complete 256-line walkthrough including Supabase project setup, database migrations, Edge Function deployment, webhook event subscriptions, and production cutover.

**Current payment implementation status**: [docs/prp-docs/PRP-STATUS.md#v040--payments-active-tracking](./docs/prp-docs/PRP-STATUS.md) — shows which features are built, which need routes, and which need UI work.

## 🔐 Authentication Setup

RescueDogs ships with full email/password + OAuth (GitHub, Google) authentication via Supabase. Out of the box, the app won't authenticate users until you create a Supabase project and configure your auth providers.

**For a brand-new forker**: start at [`docs/FORK-CHECKLIST.md`](./docs/FORK-CHECKLIST.md) — it's the master walkthrough covering every service this template integrates with.

**For auth specifically**:

1. **Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard) (free tier is fine)
2. **Run database migrations** — see [`docs/AUTH-SETUP.md` Part 1](./docs/AUTH-SETUP.md#part-1-database-setup)
3. **Configure auth providers** (pick what you need):
   - [Email/password](./docs/AUTH-SETUP.md#part-2-enable-emailpassword-authentication) — required for the messaging features
   - [GitHub OAuth](./docs/AUTH-SETUP.md#part-3-enable-github-oauth-optional) — create a [GitHub OAuth App](https://github.com/settings/developers)
   - [Google OAuth](./docs/AUTH-SETUP.md#part-4-enable-google-oauth-optional) — create a [Google Cloud OAuth client](https://console.cloud.google.com/apis/credentials)
4. **Add Supabase keys to `.env`** — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from [your project's API settings](https://supabase.com/dashboard)
5. **Verify** — run the [Management API check](./docs/AUTH-SETUP.md#verification-via-management-api) to confirm your OAuth client IDs are real values, not placeholders. (Issue #85 was caused by placeholder strings sitting in this field for weeks before anyone noticed.)

The full step-by-step is in [`docs/AUTH-SETUP.md`](./docs/AUTH-SETUP.md) (Parts 1-7, ~380 lines).

## 🔐 GitHub Actions Secrets

Add these secrets to your repository at **Settings → Secrets and variables → Actions → Repository secrets**.

### ⚠️ Required for CI/CD (Add These First)

These secrets are **required** for the build and deployment workflows to succeed:

| Secret                          | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL (e.g., `https://abc123.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key                             |

### 🧪 Recommended for E2E Testing

These secrets enable full E2E test coverage. Without them, E2E tests will be skipped or fail:

| Secret                         | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`    | Service role key for admin operations in tests                         |
| `TEST_USER_PRIMARY_EMAIL`      | Primary test user email (use Gmail plus alias: `you+test-a@gmail.com`) |
| `TEST_USER_PRIMARY_PASSWORD`   | Primary test user password                                             |
| `TEST_USER_SECONDARY_EMAIL`    | Secondary test user for multi-user tests                               |
| `TEST_USER_SECONDARY_PASSWORD` | Secondary test user password                                           |
| `TEST_USER_TERTIARY_EMAIL`     | Tertiary test user for group chat tests                                |
| `TEST_USER_TERTIARY_PASSWORD`  | Tertiary test user password                                            |
| `TEST_EMAIL_DOMAIN`            | Email domain for generated test emails (e.g., `you+e2e@gmail.com`)     |

**Note**: Supabase validates email domains have MX records. Use Gmail plus aliases (`user+tag@gmail.com`) instead of `@example.com` which is always blocked.

### 📝 Optional - Author & Site Configuration

These customize the site appearance but aren't required for builds:

| Secret                         | Description                       |
| ------------------------------ | --------------------------------- |
| `NEXT_PUBLIC_AUTHOR_NAME`      | Your display name                 |
| `NEXT_PUBLIC_AUTHOR_EMAIL`     | Contact email                     |
| `NEXT_PUBLIC_AUTHOR_BIO`       | Short biography                   |
| `NEXT_PUBLIC_AUTHOR_ROLE`      | Job title/role                    |
| `NEXT_PUBLIC_AUTHOR_AVATAR`    | Avatar image URL                  |
| `NEXT_PUBLIC_AUTHOR_GITHUB`    | GitHub username                   |
| `NEXT_PUBLIC_AUTHOR_LINKEDIN`  | LinkedIn profile URL              |
| `NEXT_PUBLIC_AUTHOR_TWITTER`   | Twitter/X handle                  |
| `NEXT_PUBLIC_AUTHOR_TWITCH`    | Twitch username                   |
| `NEXT_PUBLIC_SITE_URL`         | Production site URL               |
| `NEXT_PUBLIC_DEPLOY_URL`       | Custom deployment URL             |
| `NEXT_PUBLIC_SOCIAL_PLATFORMS` | Comma-separated list of platforms |

### 📝 Optional - Integrations

| Secret                          | Description                         |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_CALENDAR_PROVIDER` | Calendar service (e.g., `calendly`) |
| `NEXT_PUBLIC_CALENDAR_URL`      | Calendar booking URL                |
| `NEXT_PUBLIC_DISQUS_SHORTNAME`  | Disqus comments integration         |
| `NEXT_PUBLIC_PAGESPEED_API_KEY` | Google PageSpeed API key            |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics measurement ID     |
| `NEXT_PUBLIC_SENTRY_DSN`        | Sentry error-monitoring client DSN  |

Sentry monitoring is **disabled until `NEXT_PUBLIC_SENTRY_DSN` is set** (empty = no-op) and only sends events **after the user grants analytics consent**. Get the DSN from sentry.io → your project → **Client Keys (DSN)**. All events are PII-scrubbed (emails, tokens, message bodies) before leaving the browser; session replay and tracing are disabled.

### 📝 Optional - Supabase Admin (for migrations)

| Secret                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for Management API |
| `SUPABASE_DB_PASSWORD`  | Database password                        |
| `SUPABASE_PROJECT_REF`  | Project reference ID                     |

## 🔑 GitHub Personal Access Token (For Claude Code & SpecKit)

Claude Code and SpecKit use a GitHub token for **API access only** (reading issues, creating issues).
Git pushes use **SSH authentication** - keeping you in control of what gets committed.

### Creating Your Token (Read-Only API Access)

1. Go to **[GitHub Token Settings](https://github.com/settings/personal-access-tokens/new)** (fine-grained tokens)

2. Configure the token:
   - **Token name**: `RescueDogs` or `Claude Code`
   - **Expiration**: 90 days recommended
   - **Repository access**: Select "Only select repositories" → choose your repository

3. Grant these **read-only** permissions:

   | Permission    | Access        | Used For                         |
   | ------------- | ------------- | -------------------------------- |
   | Contents      | **Read-only** | Reading files, checking status   |
   | Issues        | Read & Write  | `/speckit.taskstoissues` command |
   | Pull requests | **Read-only** | Viewing PR status                |
   | Actions       | **Read-only** | Checking CI status               |

4. Click **Generate token** and copy it immediately (shown only once)

### Setup

**GitHub CLI**:

```bash
gh auth login
# Choose: GitHub.com → SSH → Paste token for API access
```

**Git pushes use SSH** (your existing SSH key):

```bash
# Verify SSH is configured
ssh -T git@github.com
# Should show: Hi USERNAME! You've successfully authenticated...
```

### Why SSH + Limited Token?

- **You control commits** - AI can't push without your SSH key
- **API access only** - Token reads issues, creates issues, checks CI
- **No accidental pushes** - All pushes require explicit user action

## 🍴 Forking This Template

The quickest way to create your own project from RescueDogs:

### 5-Minute Setup

```bash
# 1. Fork and clone
gh repo fork TortoiseWolfe/RescueDogs --clone
cd YourProjectName

# 2. Run the rebrand script (updates 200+ files automatically)
./scripts/rebrand.sh MyProject myusername "My awesome project description"

# 3. Create environment file
cp .env.example .env
# Edit .env with your UID/GID (run: id -u && id -g)

# 4. Start development
docker compose up -d

# 5. Verify everything works
docker compose exec myproject pnpm run build
docker compose exec myproject pnpm test

# 6. Commit and push
docker compose exec myproject git add -A
docker compose exec myproject git commit -m "Rebrand to MyProject"
git push
```

### Rebrand Script Options

```bash
# Preview changes without modifying files
./scripts/rebrand.sh MyProject myuser "Description" --dry-run

# Skip confirmation prompts
./scripts/rebrand.sh MyProject myuser "Description" --force

# Keep CNAME file (for custom domains)
./scripts/rebrand.sh MyProject myuser "Description" --keep-cname
```

For detailed setup instructions, see [docs/FORKING.md](./docs/FORKING.md).

### Keeping Your Fork Updated

```bash
# Add upstream and pull changes
git remote add upstream https://github.com/TortoiseWolfe/RescueDogs.git
git fetch upstream
git merge upstream/main
```

See [docs/FORKING.md](./docs/FORKING.md) for detailed sync instructions and [docs/FORKING-FEEDBACK.md](./docs/FORKING-FEEDBACK.md) for manual fixes if merging fails.

## ⚙️ Auto-Configuration

The project automatically detects your repository name and owner from git remote URL at build time:

- **Project name**: Detected from repository name
- **Owner**: Detected from GitHub username
- **Base path**: Configured for GitHub Pages deployment
- **PWA manifest**: Generated with your project name

**Troubleshooting**:

- If auto-detection fails, ensure you have a git remote: `git remote -v`
- Override with environment variables in `.env` if needed
- Check `src/config/project-detected.ts` after build to see detected values

## 📚 Documentation

- **Product vision & roadmap**: [docs/product/VISION.md](./docs/product/VISION.md) — founding pillars, what's in scope vs deferred
- **Business model (draft)**: [docs/product/BUSINESS-MODEL.md](./docs/product/BUSINESS-MODEL.md) — revenue strategy, pricing tiers, nonprofit options
- **Developer Guide**: See [CLAUDE.md](./CLAUDE.md) for comprehensive development documentation
- **Component Creation**: [docs/CREATING_COMPONENTS.md](./docs/CREATING_COMPONENTS.md)
- **PRP/SpecKit Workflow**: [docs/prp-docs/SPECKIT-PRP-GUIDE.md](./docs/prp-docs/SPECKIT-PRP-GUIDE.md) - Quick reference for feature development
- **Testing Guide**: [docs/project/TESTING.md](./docs/project/TESTING.md)
- **Contributing**: [docs/project/CONTRIBUTING.md](./docs/project/CONTRIBUTING.md)
- **Security**: [docs/project/SECURITY.md](./docs/project/SECURITY.md)
- **Changelog**: [docs/project/CHANGELOG.md](./docs/project/CHANGELOG.md)

## 📋 Technical Debt Backlog (SpecKit Ready)

For detailed tracking of E2E test fixes, helper patterns, and resolved issues, see [`docs/TECHNICAL-DEBT.md`](./docs/TECHNICAL-DEBT.md).

Run these specs in order (041 → 064). Copy a command to start the full SpecKit workflow.

### Priority 1: Blockers

**SPEC-041: ✅ COMPLETE** - GitHub secrets verified configured (2025-12-26). E2E status: **298 passed, 19 failed, 12 flaky, 61 skipped** (as of 2025-12-27).

**SPEC-042: ❌ INVALID** - File is NOT obsolete. Analysis: `tests/e2e/examples/homepage-with-pom.spec.ts` has 5 working tests + 4 skipped (with documented reasons). It's in `examples/` as a POM pattern teaching example. The 4 skips document former homepage features - this is valuable history, not technical debt.

### Priority 2: E2E Stabilization (mostly resolved - see TECHNICAL-DEBT.md)

**SPEC-043: ✅ COMPLETE** - Form honeypot fix merged (2025-12-26). Added `isHoneypotField()` helper to skip bot trap fields.

**SPEC-044: ✅ COMPLETE** - Accessibility contrast fix merged (2025-12-26). Changed `text-base-content/40` to `/60` in Footer.

**SPEC-045: ✅ COMPLETE** - Already fixed in commit 2a8aa08 (2025-12-26). All 43 message-editing tests pass.

**SPEC-046: ✅ COMPLETE** - Payment isolation fix merged (2025-12-26). Added `handlePaymentConsent()` helper. All 24 tests pass.

**SPEC-047: ✅ COMPLETE** - OAuth CSRF tests rewritten as proper security tests (2025-12-26).

**SPEC-048: ✅ COMPLETE** - Theme/PWA tests fixed with flexible assertions (2025-12-26).

### Priority 3: Group Messaging Feature

```
/speckit.workflow SPEC-049: Group Service Implementation - Complete 8 unimplemented methods in src/services/messaging/group-service.ts: addMembers (T043), getMembers (T074), removeMember (T060), leaveGroup (T061), transferOwnership (T062), upgradeToGroup (T054), renameGroup (T093), deleteGroup (T092). These methods throw "Not implemented" errors. Effort: 2-3 days.
```

### Priority 4: Unit Test Coverage

```
/speckit.workflow SPEC-050: SEO Library Tests - Add unit tests for 4 untested SEO modules: src/lib/seo/readability.ts, keywords.ts, content.ts, technical.ts. Create src/lib/seo/__tests__/ directory. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-051: Blog Library Tests - Add unit tests for 3 untested blog modules: src/lib/blog/seo-analyzer.ts, toc-generator.ts, markdown-processor.ts. Create src/lib/blog/__tests__/ directory. Effort: 3-4 hours.
```

```
/speckit.workflow SPEC-052: Messaging Service Tests - Add unit tests for core messaging services: message-service.ts (1182 lines), key-service.ts, group-key-service.ts, and src/services/auth/audit-logger.ts. Effort: 1 day.
```

```
/speckit.workflow SPEC-053: Auth Component Test Expansion - Expand 6 auth component tests that have TODO comments: AuthGuard, SignUpForm, ResetPasswordForm, SignInForm, ProtectedRoute, ForgotPasswordForm. Effort: 4-6 hours.
```

### Priority 5: Payment Features

```
/speckit.workflow SPEC-054: Payment Dashboard - Implement real-time payment dashboard with payment history table, recent transactions widget, and Supabase real-time updates. Unblocks 20 E2E tests. Effort: 2-3 days.
```

```
/speckit.workflow SPEC-055: Payment Offline Queue UI - Implement offline queue UI for payments with queue status indicator, pending payment list, and retry mechanism UI. Unblocks 18 E2E tests. Effort: 1 day.
```

```
/speckit.workflow SPEC-056: Payment Retry UI - Implement failed payment retry functionality with error display, retry button, payment method update flow, and retry confirmation. Unblocks 14 E2E tests. Effort: 1 day.
```

```
/speckit.workflow SPEC-057: PayPal Subscription Management - Implement subscription management with active subscriptions list, cancel/pause functionality, and billing cycle display. Unblocks 12 E2E tests. Effort: 2 days.
```

```
/speckit.workflow SPEC-058: Payment Security RLS - Implement payment table RLS policies in Supabase: payments table with user isolation, subscriptions table RLS, admin access policies. Unblocks 25 E2E tests. Effort: 1-2 days.
```

### Priority 6: Code Quality

```
/speckit.workflow SPEC-059: Large Component Refactoring - Refactor 4 oversized components: CaptainShipCrew.tsx (560 lines, no memoization), GlobalNav.tsx (482 lines), AccountSettings.tsx (476 lines), MessageBubble.tsx (411 lines). Add React.memo/useMemo where appropriate. Effort: 2-3 days.
```

```
/speckit.workflow SPEC-060: Error Handler Integrations - Implement TODO integrations in src/utils/error-handler.ts: Add Sentry/LogRocket/DataDog logging (line 233), add toast notification system (line 252), remove console-only logging. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-061: ESLint Disable Cleanup - Review and document 11 eslint-disable comments across codebase. Add JSDoc explaining necessity, fix underlying issues where possible, remove unnecessary disables. Effort: 2-3 hours.
```

```
/speckit.workflow SPEC-062: Hardcoded UUID Fix - Fix hardcoded UUID '00000000-0000-0000-0000-000000000000' in src/lib/payments/offline-queue.ts:166. Replace with auth context user ID. Effort: 30 min.
```

### Priority 7: Minor Improvements

```
/speckit.workflow SPEC-063: Disqus Theme Enhancement - Improve Disqus theme integration in src/components/molecular/DisqusComments.tsx. Map DaisyUI themes to Disqus color schemes, investigate CSS custom properties. Low priority UX improvement. Effort: 4-6 hours.
```

```
/speckit.workflow SPEC-064: Game Component A11y Tests - Expand 5 game component accessibility tests: CaptainShipCrewWithNPC, CaptainShipCrew, Dice, DraggableDice, DiceTray. Add keyboard navigation, ARIA verification, focus management tests. Effort: 4-6 hours.
```

## 🎯 Project Status

**Version 0.3.5** - Sprint 3.5 Complete ✅ | 12 of 14 PRPs completed

| Category      | Completed                                         | Remaining         |
| ------------- | ------------------------------------------------- | ----------------- |
| Foundation    | Component Structure, E2E Testing                  | PRP Methodology   |
| Accessibility | WCAG AA, Colorblind Mode, Font Switcher           | -                 |
| Privacy       | Cookie Consent, Google Analytics                  | -                 |
| Forms         | Web3Forms Integration, EmailJS, PWA Sync          | -                 |
| Features      | Calendar Integration, Geolocation Map             | Visual Regression |
| Tech Debt     | Sprint 3.5: All 46 tasks complete (2025-09-19) ✨ | -                 |

See [docs/prp-docs/PRP-STATUS.md](./docs/prp-docs/PRP-STATUS.md) for detailed progress.

## 🏆 Lighthouse Scores

[![WCAG 2.1 AA Compliant](https://img.shields.io/badge/WCAG%202.1-AA%20Compliant-success)](https://www.w3.org/WAI/WCAG21/quickref/)

- **Performance**: 92/100
- **Accessibility**: 98/100
- **Best Practices**: 95/100
- **SEO**: 100/100
- **PWA**: 92/100

## 🤝 Contributing

1. Fork the repository (for contributing back to RescueDogs)
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Run tests in Docker (`docker compose exec rescuedogs pnpm test`)
4. Commit changes (`git commit -m 'Add feature'`)
5. Push and open a PR

## Design System Redesign

Custom RescueDogs theme (dark default + light variant) built on the existing DaisyUI/Tailwind stack. Storybook upgrade to v10, hierarchy cleanup, then bottom-up component reskin. Includes theme template tooling for forks.

**Design doc**: [docs/plans/2026-02-13-design-system-redesign.md](./docs/plans/2026-02-13-design-system-redesign.md)
**Implementation plan**: [docs/plans/2026-02-13-design-system-implementation.md](./docs/plans/2026-02-13-design-system-implementation.md)

### Progress

| Phase | Description                                          | Status   |
| ----- | ---------------------------------------------------- | -------- |
| 0     | Hierarchy cleanup (8 component moves)                | Complete |
| 1     | Storybook 9.1.5 → 10.2.8                             | Complete |
| 2     | Custom DaisyUI themes (dark + light, WCAG AAA)       | Complete |
| 3     | Theme template system (CUSTOM-THEME.md + rebrand.sh) | Complete |
| 4     | Redesign atomic components                           | Complete |
| 5     | Rebuild molecular & organism components              | Next     |
| 6     | Page-by-page polish                                  | Pending  |

Current component hierarchy: 22 atomic, 17 molecular, 8 organisms.

### Session Continuation Prompt

```
Read these files to pick up the design system redesign:

1. CLAUDE.md - Project rules, Docker setup, component standards
2. docs/plans/2026-02-13-design-system-redesign.md - Approved design (Phase 4 section)
3. docs/plans/2026-02-13-design-system-implementation.md - Task-by-task plan
4. src/app/globals.css - Custom theme definitions (rescuedogs-dark, rescuedogs-light)

Use superpowers:executing-plans to work through the implementation plan.
Phases 0-6 complete. Next: final polish or new feature work.

Key context:
- Everything runs inside Docker: docker compose exec rescuedogs <command>
- pnpm, not npm
- DaisyUI beta with Tailwind v4 CSS-first config (@plugin syntax)
- RescueDogs is a template, design must be bold but also easy to rebrand
- Brand colors: silver/steel (primary), warm amber (secondary), electric accent, charcoal base
- Dark theme default, light variant available
- Both themes pass WCAG AAA (7:1) contrast
- Preserve all existing accessibility work
- Aesthetic: bold, industrial, developer-focused. VS Code dark meets metallic craftsmanship.
- Component hierarchy: 22 atomic, 17 molecular, 8 organisms
- Pattern: audit component in Storybook against both themes, update, verify a11y, commit
```

## 📄 License

MIT - See [LICENSE](./LICENSE) for details

---

**For Template Users**: Your project name is automatically detected from your new repository! No manual configuration needed. See [docs/TEMPLATE-GUIDE.md](./docs/TEMPLATE-GUIDE.md) for details.

---

<details>
<summary>🧰 E2E Fix Loop Priming Prompt (for maintainers)</summary>

If the E2E test suite is broken and you want to run `/loop` to keep iterating on it,
paste the priming prompt from [docs/e2e-loop-priming.md](./docs/e2e-loop-priming.md)
into the loop command. It lists the **current open issues** (not a baseline) with
concrete symptoms, what's been tried, what failed, and rules for not regressing.

**Current state (2026-04-19, commit `4b003d5`)**: NOT green. Latest run `24624967629`
failed. The GoTrue brute-force lockouts that plagued rounds 1-10 are solved (pre-auth
User B fixture, commit `1477816`), but 3 categories of hard-fail remain:

1. **`payment-isolation.spec.ts`** on chromium-gen/firefox-gen/webkit-gen 4/6 —
   storageState-based auth hydration is unreliable in manually-created
   `browser.newContext()` on these tests. Tests 44, 113, 184, 216 see user=null
   where project-level `{ page }` storageState works fine.
2. **Firefox realtime WebSocket** rejects Cloudflare's `__cf_bm` cookie on
   Supabase's `/realtime/v1/websocket` endpoint — firefox-msg-specific, infrastructure.
3. **Webkit shard cancellation cascade** when one upstream webkit shard fails —
   workflow-level artifact propagation, not test content.

**Also required (user action, not code)**: Supabase dashboard rate-limit exemption
per [`docs/testing/CI-SETUP.md`](./docs/testing/CI-SETUP.md). Without it, the ~15
legitimate live `performSignIn` calls in auth/ tests can still trigger lockouts.

Do not treat the priming doc as a clean baseline — read its "Current Open Issues"
section for where things actually stand.

</details>
