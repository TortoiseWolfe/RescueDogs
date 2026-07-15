# Homepage hero + provisional RP nav logo (#44)

**Date:** 2026-07-14
**Author:** schlajo (with Cursor)
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/44
**PR:** _(open)_
**Branch:** `fix/44-hero-tracker-copy`

## Goal

Align the homepage hero with Raised Paws tracker positioning, enlarge the hero
illustration, move the Dogs and Cats badge over the photo column, and replace
the template nav logo with a provisional transparent RP medallion.

## What we did

- Hero H1: orange **Raised Paws** + white remainder — tracker / anti-ghosting copy
- Subcopy: orange brand color (revisit if contrast feels weak in review)
- Badge moved above right-column image; image bumped toward `lg:max-w-[640px]`, aspect `4/3`
- `public/raised-paws-logo.png` (transparent corners) + `scripts/make-logo-transparent.js`
- `GlobalNav`: `LayeredRescueDogsLogo` → `Image` of RP logo beside wordmark

## Verify

```bash
docker compose exec rescuedogs pnpm run type-check
docker compose exec rescuedogs pnpm run lint
```

Manual: `/` desktop + mobile — badge above image; orange Raised Paws in H1; logo in header without white square.
