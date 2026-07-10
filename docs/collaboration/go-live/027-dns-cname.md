# DNS + CNAME + basePath drop (#27)

**Date:** 2026-07-09
**Author:** schlajo (with Cursor)
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/27
**PR:** _(open)_
**Branch:** `fix/27-raisedpaws-dns-cname`

## Goal

Point **`raisedpaws.com`** at GitHub Pages and drop the `/RescueDogs` basePath so the
site serves from `/` at the apex domain. Configure **`raisedpaws.org`** → 301 to
`.com` at Namecheap (manual, outside repo).

Hosting: **GitHub Pages** (see [DECISIONS.md](./DECISIONS.md)).

## Decisions

- Canonical: `raisedpaws.com`; only `raisedpaws.org` redirects; `heldpaws.*` abandoned.
- GitHub Pages over Vercel — simpler for Jon; one redirect doesn't need Vercel.

## What we did (repo)

- **`public/CNAME`** — single line: `raisedpaws.com`
  - Triggers `scripts/detect-project.js` to set `basePath = ''` on GitHub Actions builds
    (`isGitHubActions && isGitHub && !cnameExists` branch no longer applies).
- **`docs/collaboration/`** — decision log + session notes for learning channel.

## Manual steps (Namecheap + GitHub — schlajo)

**Start these only after merge + green deploy** (see [DECISIONS.md](./DECISIONS.md)).

### A. `raisedpaws.com` → GitHub Pages

**Namecheap → Domain List → raisedpaws.com → Manage → Advanced DNS**

Remove parking records if present. Add:

| Type      | Host  | Value                      |
| --------- | ----- | -------------------------- |
| **A**     | `@`   | `185.199.108.153`          |
| **A**     | `@`   | `185.199.109.153`          |
| **A**     | `@`   | `185.199.110.153`          |
| **A**     | `@`   | `185.199.111.153`          |
| **AAAA**  | `@`   | `2606:50c0:8000::153`      |
| **AAAA**  | `@`   | `2606:50c0:8001::153`      |
| **AAAA**  | `@`   | `2606:50c0:8002::153`      |
| **AAAA**  | `@`   | `2606:50c0:8003::153`      |
| **CNAME** | `www` | `tortoisewolfe.github.io.` |

**GitHub → TortoiseWolfe/RescueDogs → Settings → Pages**

- Custom domain: `raisedpaws.com`
- Wait for DNS check → **Enforce HTTPS**

### B. `raisedpaws.org` → redirect (after `.com` works)

**Namecheap → raisedpaws.org → Redirect Domain** (or URL Forwarding)

- Permanent (301) → `https://raisedpaws.com`

### C. After merge + deploy

Update GitHub Actions **Variables** (Settings → Secrets and variables → Actions):

- `NEXT_PUBLIC_DEPLOY_URL` = `https://raisedpaws.com`
- `NEXT_PUBLIC_SITE_URL` = `https://raisedpaws.com`
- `NEXT_PUBLIC_BASE_URL` = `https://raisedpaws.com`

Then run **#28** (Supabase auth redirects) before announcing go-live.

## Verify

```bash
docker compose exec rescuedogs pnpm run type-check
docker compose exec rescuedogs pnpm run build
# Confirm out/index.html and asset paths have no /RescueDogs prefix
```

After DNS propagates:

```bash
dig raisedpaws.com +short
curl -sI https://raisedpaws.com/ | head -5
curl -sI https://raisedpaws.org/ | head -5   # expect 301 → .com
```

Manual: homepage loads at `https://raisedpaws.com`, Raised Paws branding, no `/RescueDogs` in URLs.

## Gotchas

- DNS can take minutes to 48 hours; GitHub Pages DNS check must go green before HTTPS.
- Auth (sign-in, email links) **won't work** until #28 Supabase URLs are updated.
- Do not delete `public/CNAME` after go-live — rollback to `github.io/RescueDogs` depends on it.

## Outcome

_Pending: PR merge, DNS propagation, #28 Supabase cutover._
