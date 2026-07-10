# Raised Paws rebrand + orange/navy/white palette (#32)

**Date:** 2026-07-08 – 2026-07-09
**Author:** schlajo (with Cursor)
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/32
**PR:** https://github.com/TortoiseWolfe/RescueDogs/pull/33 (merged 2026-07-09)
**Branch:** `fix/32-raised-paws-palette`

## Goal

Rebrand user-facing **Held Paws** → **Raised Paws** and apply the orange / navy /
white palette ahead of go-live (#27–#29). Canonical domain is `raisedpaws.com`
(#26). This ticket was design-only — no DNS, CNAME, or Supabase redirect changes.

## Decisions

- **Palette source of truth:** orange `#f97316`, navy `#1e3a8a`, white text on
  orange and navy in both light and dark themes; baby blue as optional accent only.
- **Install App / PWA button styling** — experimented with navy styling in light
  mode; reverted. Kept default gray `btn-neutral`; PWA install only appears when
  Chrome fires `beforeinstallprompt` (often after sign-in). Out of scope for #32.
- **Blog JSON body copy** — left as optional follow-up per issue scope.

## What we did

- **`src/config/project.config.ts`** — `projectDisplayName: 'Raised Paws'`.
- **41 files** — metadata titles, nav/footer, welcome message, web3forms sender,
  themes copy, unit tests, stories, E2E strings.
- **`src/app/globals.css`** — orange site header in light and dark; dark-theme
  primary tokens adjusted so accents stay readable.
- **`src/app/page.tsx`** — navy hero gradient, step colors (navy / orange / baby
  blue), orange CTA box, hero image negative margin tweak.
- **`src/components/Footer.tsx`** — navy background, white text.

Merged after full CI green (unit, lint, component structure, accessibility, E2E
shards).

## Gotchas

- **Localhost 500 after push** — pre-push hook runs `clean:next` while dev server
  is running. Fix: `docker compose down`, remove `.next` in container, restart.
- **DaisyUI token overrides** — styling the Install button with navy/orange
  fought theme tokens (orange-on-orange visibility). Reverting PWA experiments
  was the right call for this ticket.
- **Branch hygiene** — merged #31 (#19 label gaps) first, then branched #32 from
  fresh `main` as specified in the issue.

## Verify

```bash
docker compose exec rescuedogs pnpm run type-check
docker compose exec rescuedogs pnpm run lint
```

Manual:

- `/` homepage — "Raised Paws" in nav and hero
- Light + dark themes — orange top bar, navy hero, white text on orange/navy surfaces
- Dark mode — page background stays dark (not swapped to white)

## Outcome

**Merged** — PR #33 into `main` at `6b48fdb`. Ready to start go-live tickets
(#27 DNS/CNAME, #28 Supabase redirects, #29 PWA scope).
