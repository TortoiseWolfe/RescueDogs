# DNS + CNAME + basePath drop (#27)

**Date:** 2026-07-09 – 2026-07-10
**Author:** schlajo (with Cursor)
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/27
**PR (code):** https://github.com/TortoiseWolfe/RescueDogs/pull/36 (merged)
**PR (journal):** _(this doc update)_
**Branch:** `fix/27-raisedpaws-dns-cname` → `docs/27-go-live-journal`

## Goal

Point **`raisedpaws.com`** at GitHub Pages and drop the `/RescueDogs` basePath so the
site serves from `/` at the apex domain. Configure **`raisedpaws.org`** → 301 to
`.com` at Namecheap (manual, outside repo).

Hosting: **GitHub Pages** (see [DECISIONS.md](./DECISIONS.md)).

## Decisions

- Canonical: `raisedpaws.com`; only `raisedpaws.org` redirects; `heldpaws.*` abandoned.
- GitHub Pages over Vercel — simpler for Jon; one redirect doesn't need Vercel.

## What we did (repo)

- **`public/CNAME`** — single line: `raisedpaws.com` (PR #36)
  - Triggers `scripts/detect-project.js` to set `basePath = ''` on GitHub Actions builds.
- **`scripts/__tests__/detect-project.test.js`** — tests for CNAME-present vs absent paths.
- **`docs/collaboration/`** — decision log + session notes for learning channel.

## Manual steps completed (ops)

### A. `raisedpaws.com` → GitHub Pages — ✅

- Namecheap Advanced DNS: GitHub apex A/AAAA records + `www` CNAME to `tortoisewolfe.github.io.`
- Kept existing SPF TXT on `@` (email forwarding; harmless for Pages).
- GitHub → Settings → Pages → custom domain `raisedpaws.com` → **DNS check successful**
- **Enforce HTTPS** enabled after certificate issued (~same evening).

### B. `raisedpaws.org` → redirect — ⏳ configured, propagating

- Namecheap → Domain tab → Redirect Domain (source **without** `http://`):
  - `raisedpaws.org` → `https://raisedpaws.com`
  - `www.raisedpaws.org` → `https://raisedpaws.com`
- As of 2026-07-10 ~03:30 UTC: redirect not fully propagated yet (apex still hit
  Namecheap parking / `www` hop). Re-check in browser after ~30 min–24 hr.

### C. GitHub Actions variables + redeploy — ✅

Updated **Settings → Secrets and variables → Actions → Variables**:

| Variable                 | Value                              |
| ------------------------ | ---------------------------------- |
| `NEXT_PUBLIC_DEPLOY_URL` | `https://raisedpaws.com`           |
| `NEXT_PUBLIC_SITE_URL`   | `https://raisedpaws.com` _(added)_ |
| `NEXT_PUBLIC_BASE_URL`   | `https://raisedpaws.com` _(added)_ |

Re-ran **Deploy to GitHub Pages** on `main` — green. Deploy warnings (non-blocking):

- Node.js 20 deprecation notice on `upload-artifact` (CI only).
- `NEXT_PUBLIC_PAGESPEED_API_KEY` unset — `/status` metrics disabled (cosmetic).

## Verify

```bash
curl -sI https://raisedpaws.com/ | head -5          # 200 OK
curl -sIL http://raisedpaws.org/ | grep -E 'HTTP|Location'  # expect → .com when propagated
```

Manual: `https://raisedpaws.com` loads Raised Paws; asset paths use `/_next/...` (no `/RescueDogs`).

## Gotchas

- **Namecheap redirect source URL:** use `raisedpaws.org` only — not `http://raisedpaws.org`.
- **HTTPS cert:** grayed out with “allow 24 hours” until certificate issued; then Enforce HTTPS became clickable.
- **DNS before merge:** wait for PR #36 merge + green deploy before pointing DNS (avoids broken basePath).
- **Auth (sign-in, email links)** still broken until **#28** Supabase redirect URLs updated.
- Do not delete `public/CNAME` — rollback to `github.io/RescueDogs` depends on it.

## Outcome

**#27 ops substantially complete.** Live at **`https://raisedpaws.com`**.

| Remaining                                 | Ticket                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| Confirm `.org` redirect propagation       | #27 follow-up (Namecheap only)                               |
| Supabase Site URL + redirect allow-list   | **#28** — see [028-supabase-auth.md](./028-supabase-auth.md) |
| PWA manifest check + CLAUDE.md CNAME note | **#29**                                                      |
