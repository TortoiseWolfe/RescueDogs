# Tasks: Configurable Adoption Application — Phase 1

**Input**: [plan.md](./plan.md), [spec.md](./spec.md)
**Scope**: Phase 1 (#337 step 1). Stories 1 and 2 (backend only).

## Setup

- [x] T001 Read the monolithic migration's applications/adopter_profiles sections and the RLS section to place the new section after them.

## Tests first (US2 privacy, US1 carry-over)

- [x] T002 [US2] `tests/rls/application-answers-rls.test.ts`: bank is readable, not writable, and has exactly the 17 locked ids.
- [x] T003 [US1] Same file: saving a profile syncs saved answers with the plan's mapping; blanking a column clears its answer.
- [x] T004 [US2] Same file: saved answers are invisible to a stranger and to shelter staff.
- [x] T005 [US2] Same file: a submitted application's snapshot contains exactly the locked core when the rescue shows nothing extra, even if the client sends a forged snapshot.
- [x] T006 [US2] Same file: an extra saved answer the rescue doesn't show is absent; after the rescue shows it, a new application includes it and the earlier one is unchanged.
- [x] T007 [US2] Same file: a dog-only shown question is excluded from a cat application.
- [x] T008 [US2] Same file: clients cannot write `shelter_application_questions`.

## Implementation

- [x] T009 [US1] Migration: `application_questions` table, RLS, and the full bank seed from the PRP.
- [x] T010 [US2] Migration: `shelter_application_questions` table and RLS (read-only for clients).
- [x] T011 [US1] Migration: `adopter_answers` table and own-row RLS.
- [x] T012 [US1] Migration: mapping function, sync trigger on `adopter_profiles`, one-time backfill.
- [x] T013 [US2] Migration: `applications.answers_snapshot`, snapshot builder, BEFORE INSERT trigger.
- [x] T014 Types: `AnswerSnapshotEntry` and `Application.answers_snapshot` in `src/types/applications.ts`; new tables and column in `src/lib/supabase/types.ts`.

## Verify and roll out

- [x] T015 `pnpm run type-check`, `pnpm run lint`, `pnpm test` in Docker.
- [x] T016 Product owner approves applying to the live database.
- [x] T017 Apply the new section via the Management API; reload schema; check every profile has saved answers.
- [x] T018 `pnpm test:rls` (new file plus existing `application-rls.test.ts`).
- [ ] T019 Commit and PR ("Part of #337").
