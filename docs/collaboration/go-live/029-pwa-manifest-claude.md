# PWA manifest + CLAUDE.md CNAME note (#29)

**Date:** 2026-07-13
**Author:** schlajo (with Cursor)
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/29
**PR:** _(open)_
**Branch:** `fix/29-pwa-manifest-claude`

## Goal

Confirm the PWA manifest is correct at the apex domain after #27, invert the
outdated `CLAUDE.md` CNAME fork-note so future upstream merges do not delete
`public/CNAME`, and document how we refer to Raised Paws (tracker vs “rescue
app”) in `VISION.md`.

Parent: [#25](https://github.com/TortoiseWolfe/RescueDogs/issues/25).

## Decisions

- Apex `scope` / `start_url` of `/` is correct once `basePath` is empty — no
  path prefix change required, only branding/theme alignment.
- Brand manifest as **Raised Paws — Pet Adoption Tracker**; theme color
  `#1e3a8a` (Trusted Care navy).
- PWA shortcuts should match the product loop (Adopt / My applications /
  Sign in), not template Themes/Components pages.
- Prefer **adoption tracker / anti-ghosting platform** language; avoid leading
  with “pet rescue and adoption app.”

## What we did

### PWA manifest

- Verified live before change: `https://raisedpaws.com/manifest.json` already
  had `scope`/`start_url` = `/`; icons 200 OK.
- Updated `public/manifest.json` — Raised Paws branding, navy theme, product
  shortcuts (still `/` scope).
- Aligned `generateManifest()` in `src/config/project.config.ts` + unit tests.
- Tagline in project config: **Pet Adoption Tracker**.

### CLAUDE.md

- Inverted Fork Notes: `public/CNAME` **MUST exist** with `raisedpaws.com` and
  must survive upstream merge + rebrand.
- Live site line → `https://raisedpaws.com`.

### Product naming

- Added **How we refer to Raised Paws** to `docs/product/VISION.md`.

### README live demo (related go-live URLs)

- Pointed the demo walkthrough links at `raisedpaws.com` instead of
  `github.io/RescueDogs`.

## Verify

```bash
curl -s https://raisedpaws.com/manifest.json | head -20
# After merge/deploy: name Raised Paws, scope "/", start_url "/"

grep -n "CNAME must NOT exist" CLAUDE.md   # expect no matches
grep -n "raisedpaws.com" CLAUDE.md           # expect CNAME + Live site lines

docker compose exec rescuedogs pnpm run type-check
docker compose exec rescuedogs pnpm exec vitest run src/config/__tests__/project.config.test.ts
```

## Gotchas

- Static `public/manifest.json` is what GitHub Pages ships; `generateManifest()`
  is the in-code generator used by tests/helpers — keep them consistent.
- Do not delete `public/CNAME` when syncing upstream.

## Outcome

| Step                          | Status         |
| ----------------------------- | -------------- |
| Live apex scope `/` verified  | ✅ Pre-change  |
| Manifest Raised Paws branding | ✅ In PR       |
| CLAUDE.md CNAME inverted      | ✅ In PR       |
| VISION naming guidance        | ✅ In PR       |
| Deploy + re-check live JSON   | ⏳ After merge |

**Go-live arc:** after #29 merges, ops tickets #27–#29 are complete for launch.
