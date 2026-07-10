# Collaboration Learning Journal

Structured session notes for collaborator implementation work on RescueDogs,
written for review and reuse on Jon's learning channel. This is **not** a chat
transcript — each entry summarizes goals, decisions, work done, pitfalls, and
verification after a ticket lands.

## Audience

- **Collaborators** (e.g. schlajo) — quick handoff context between sessions
- **Tech lead** — teaching material tied to real issues and PRs
- **Future contributors** — "why we did it this way" without digging through GitHub

## What belongs here

| Include                           | Skip                                            |
| --------------------------------- | ----------------------------------------------- |
| Issue / PR links                  | Raw Cursor transcripts                          |
| Decisions and rationale           | Secrets (`.env`, API keys, tokens)              |
| Files touched (high level)        | DNS credentials or account passwords            |
| Gotchas and debugging lessons     | Long exploratory dead ends (unless pedagogical) |
| Verify commands and manual checks |                                                 |

## Layout

```
docs/collaboration/
├── README.md                 # This file
└── go-live/                  # Raised Paws go-live arc (#25–#29)
    ├── DECISIONS.md            # Decision log (before/during implementation)
    ├── 2026-07-09-session.md # Daily index (optional)
    └── <issue#>-<slug>.md    # One entry per completed ticket
```

Add new folders (e.g. `design/`, `bugs/`) when a work stream grows beyond go-live.

## Entry template

Copy into a new file: `go-live/<issue#>-<short-slug>.md`

````markdown
# <Title> (#<issue>)

**Date:** YYYY-MM-DD
**Author:** <name>
**Issue:** https://github.com/TortoiseWolfe/RescueDogs/issues/<N>
**PR:** https://github.com/TortoiseWolfe/RescueDogs/pull/<N> (merged | open)
**Branch:** `fix/<N>-<slug>`

## Goal

One paragraph: what this ticket was meant to accomplish.

## Decisions

- Bullet list of choices made (or links to issues like #26 for domain canon).

## What we did

- High-level changes (config, CSS, components, tests).
- Link to key files if helpful.

## Gotchas

- Things that slowed us down or surprised us (Docker, DaisyUI, CI, etc.).

## Verify

```bash
# commands run in container
docker compose exec rescuedogs pnpm run type-check
docker compose exec rescuedogs pnpm run lint
```
````

- Manual checks performed.

## Outcome

- Merged / pending CI / blocked on X.

```

## Workflow

1. **Before work** — confirm branch from `main` (see `.cursor/rules/issue-branch-workflow.mdc`).
2. **During work** — implement the issue; no journal update required mid-flight.
3. **After ticket** — add or update the issue entry; include the journal file in the
   same PR as the fix when possible (keeps story and code together).
4. **After merge** — optional daily index line in `go-live/YYYY-MM-DD-session.md`.

## Related docs

| Topic | Location |
| ----- | -------- |
| Go-live roadmap | [Issue #25](https://github.com/TortoiseWolfe/RescueDogs/issues/25) |
| Canonical domain | [Issue #26](https://github.com/TortoiseWolfe/RescueDogs/issues/26) |
| Multi-terminal journals (factory) | `docs/interoffice/journals/` |
| Cursor issue workflow | `.cursor/rules/issue-branch-workflow.mdc` |
```
