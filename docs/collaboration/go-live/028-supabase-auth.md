# Supabase auth + edge env for raisedpaws.com (#28)

**Date:** 2026-07-12
**Author:** schlajo (with Cursor)
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/28
**PR:** _(open)_
**Branch:** `fix/28-supabase-auth-redirects`

## Goal

Point Supabase Auth and payment Edge Functions at **`https://raisedpaws.com`**
so sign-up emails, password resets, OAuth callbacks, and Stripe return URLs
land on the custom domain — not `tortoisewolfe.github.io/RescueDogs`.

Parent: [#25](https://github.com/TortoiseWolfe/RescueDogs/issues/25). Depends on
[#27](https://github.com/TortoiseWolfe/RescueDogs/issues/27) DNS/CNAME (done).

## Background — how redirects are built

The app composes redirect URLs as `origin + basePath + path` with **forced
trailing slashes** (`src/config/project.config.ts` — `getRedirectUrl`). Callers:

- `src/contexts/AuthContext.tsx` — `emailRedirectTo: getRedirectUrl('/auth/callback')`
- `src/components/auth/OAuthButtons/OAuthButtons.tsx` — `redirectTo: getRedirectUrl('/auth/callback')`
- `src/components/auth/ForgotPasswordForm/ForgotPasswordForm.tsx` — `redirectTo: getRedirectUrl('/reset-password')`

At apex (`basePath ''`), production emits:

- `https://raisedpaws.com/auth/callback/`
- `https://raisedpaws.com/reset-password/`

Supabase uses **exact-match** allow-list entries — trailing slashes required.

## Desired auth config (repo)

`scripts/supabase/auth-config.raisedpaws.json` — Management API desired state:

- **Site URL:** `https://raisedpaws.com`
- **Redirect URLs:** raisedpaws.com callback + reset-password; legacy github.io
  entries kept until cutover verified; localhost dev entries for Docker.

### Apply via script (preferred)

Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (or
`NEXT_PUBLIC_SUPABASE_PROJECT_REF`) in `.env` — **gitignored, never commit**.

```bash
# Dry-run diff
docker compose exec rescuedogs pnpm supabase:auth-config --config scripts/supabase/auth-config.raisedpaws.json

# Apply + verify
docker compose exec rescuedogs pnpm supabase:auth-config --config scripts/supabase/auth-config.raisedpaws.json --apply
```

Project ref: `cmdhajshektesctrappl` (RescueDogs, us-east-2).

### Manual dashboard fallback

**Supabase → Authentication → URL Configuration:**

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Site URL**      | `https://raisedpaws.com`                                                             |
| **Redirect URLs** | `https://raisedpaws.com/auth/callback/`                                              |
|                   | `https://raisedpaws.com/reset-password/`                                             |
|                   | `https://tortoisewolfe.github.io/RescueDogs/auth/callback/` _(keep until verified)_  |
|                   | `https://tortoisewolfe.github.io/RescueDogs/reset-password/` _(keep until verified)_ |
|                   | `http://localhost:3000/auth/callback/` _(dev)_                                       |
|                   | `http://localhost:3000/reset-password/` _(dev)_                                      |

## Edge-function env (CORS + Stripe returns)

Edge Functions read `NEXT_PUBLIC_SITE_URL` for CORS (`supabase/functions/_shared/cors.ts`)
and Stripe `success_url` / `cancel_url`.

Set the secret on project `cmdhajshektesctrappl`:

```bash
supabase secrets set NEXT_PUBLIC_SITE_URL=https://raisedpaws.com --project-ref cmdhajshektesctrappl
```

Or: **Supabase Dashboard → Edge Functions → Secrets**.

## GitHub Actions variables

Confirmed in [#27 journal](./027-dns-cname.md) — should already be set:

| Variable                 | Value                    |
| ------------------------ | ------------------------ |
| `NEXT_PUBLIC_DEPLOY_URL` | `https://raisedpaws.com` |
| `NEXT_PUBLIC_SITE_URL`   | `https://raisedpaws.com` |
| `NEXT_PUBLIC_BASE_URL`   | `https://raisedpaws.com` |

If changed, re-run **Deploy to GitHub Pages** on `main` so the static build bakes
the new URLs.

## Verify (all four before removing github.io entries)

| Check              | Expected                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| **Demo sign-in**   | `adopter@demo.test` / `DemoPass123!` at `https://raisedpaws.com/sign-in/` |
| **Sign-up email**  | Confirmation link lands on `https://raisedpaws.com/auth/callback/`        |
| **Password reset** | Email link lands on `https://raisedpaws.com/reset-password/`              |
| **OAuth**          | GitHub/Google round-trip to raisedpaws.com _(when providers enabled)_     |
| **Stripe test**    | Checkout success/cancel returns to raisedpaws.com _(if payment keys set)_ |

Only after all pass: remove legacy `github.io/RescueDogs` redirect entries from
Supabase.

## Gotchas

- **Trailing slashes** — allow-list must match exactly; GitHub Pages 301s
  slashless URLs, which Supabase rejects.
- **No token in repo** — `SUPABASE_ACCESS_TOKEN` lives in local `.env` only;
  script refuses to run without it.
- **OAuth buttons hidden** — sign-in/sign-up pages comment out `OAuthButtons`
  until providers are configured in Supabase; email/password is the primary
  verify path for #28.
- **Edge secret is separate** from Auth URL config — both must be updated.

## Outcome

| Step                                    | Status                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `auth-config.raisedpaws.json` + journal | ✅ In repo (PR #41)                                                    |
| Supabase Auth URL config                | ✅ Applied via `supabase:auth-config:raisedpaws --apply` (2026-07-12)  |
| Edge `NEXT_PUBLIC_SITE_URL` secret      | ✅ Set in Supabase dashboard                                           |
| GitHub Actions variables                | ✅ Done in #27                                                         |
| Demo sign-in on raisedpaws.com          | ✅ `adopter@demo.test` verified                                        |
| Sign-up / password-reset email links    | ⏳ Deferred — built-in SMTP rate limit; retry later or add custom SMTP |
| Remove legacy github.io redirect URLs   | ⏳ After optional email-link verify                                    |

**Next after #28:** [#29](https://github.com/TortoiseWolfe/RescueDogs/issues/29) PWA manifest + `CLAUDE.md` CNAME note.
