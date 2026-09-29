# Code Review Backlog — full repository

Whole-repo review (not a diff review) run on 2026-09-29 against `claude/zealous-hamilton-32oetx`
at `d40085c`. Findings come from reading code; nothing was executed. Each reviewer verified every
candidate against callers, guards, RLS policies and tests before reporting it.

## Severity legend

| Level | Meaning |
| ----- | ------- |
| **P0** | Security hole, data loss, auth bypass, money charged or lost |
| **P1** | User-facing bug on a real path, or a check/test that hides real failure |
| **P2** | Latent bug, edge case, wrong under some configuration |
| **P3** | Minor / robustness |

## Summary

_In progress — updated as tiers report._

## Coverage

| Tier | Scope | Status |
| ---- | ----- | ------ |
| T1 | DB schema/RLS, edge functions, auth, payments, contexts, schemas | pending |
| T2 | Messaging, E2E crypto, offline queue, service worker | pending |
| T3 | Adoption domain: applications, pets, photos, admin, portal, browse, email | pending |
| T4 | Pages/routing (`src/app`), hooks, utils, config, SEO/blog/monitoring libs | pending |
| T5 | UI components — security-sensitive (auth, payment, privacy, forms, messaging) | pending |
| T6 | UI components — the rest | pending |
| T7 | `scripts/`, CI workflows, Docker, hooks, build config | pending |
| T8 | Tests (`tests/`, `src/tests`, `scripts/__tests__`) | pending |

Not reviewed (prose, not code): `docs/`, `features/`, `specs/`, `.specify/`, `.claude/`, `public/blog`, wireframe SVGs.

## P0

## P1

## P2

## P3
