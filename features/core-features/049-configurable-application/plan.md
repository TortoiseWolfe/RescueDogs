# Implementation Plan: Configurable Adoption Application — Phase 1 (storage and privacy)

**Branch**: `feat/337-question-bank-storage` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)
**Scope**: Phase 1 only (#337 step 1). Phases 2–4 get their own plan after the wireframe gate.

## Summary

Add the shared question bank, per-rescue question choices, per-adopter saved answers, and a per-application answers snapshot that the database builds itself from only the questions that rescue shows. Copy every existing adopter profile into saved answers and keep them in sync while today's form is still the only form. No UI changes.

## Technical Context

- **Database**: Supabase Postgres, single live project. All schema in the monolithic migration `supabase/migrations/20251006_complete_monolithic_setup.sql`, idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`). Applied via the Supabase Management API.
- **Client**: Next.js static export; all data access is client-side Supabase under RLS. No API routes.
- **Testing**: `pnpm test` (Vitest unit) must stay green; `pnpm test:rls` (live project, service-role key) proves the privacy rules.
- **Constraint**: today's `ApplicationForm` and `ApplicationService.submitApplication` keep working unchanged.

## Constitution Check

| Principle                      | How phase 1 complies                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| II. Seconds, not training      | No rescue or adopter action needed; carry-over is automatic.                                                                                                                                      |
| III. Applicant data is a trust | Snapshot is built **in the database** from the rescue's shown questions, overriding anything the client sends. Saved answers are strictly own-row. Staff read only snapshots. RLS tests prove it. |
| V. Extend the loop             | Extends the universal application → dashboard → tracker loop; no new pillar.                                                                                                                      |
| Monolithic migration           | One new section in the monolithic file; no separate migration files.                                                                                                                              |
| Docker-first                   | All commands via `docker compose exec rescuedogs`.                                                                                                                                                |

## Data model

### `application_questions` (the bank)

| Column                                         | Type            | Notes                                                                                                                                                       |
| ---------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                           | TEXT PK         | Stable id from the PRP, e.g. `hou.home_type`. Never reused.                                                                                                 |
| `category`                                     | TEXT            | `contact`, `application`, `eligibility`, `household`, `housing`, `yard`, `pets`, `vet`, `references`, `lifestyle`, `training`, `scenarios`, `pet_specific`  |
| `sort_order`                                   | SMALLINT UNIQUE | Global display order (category blocks of 100).                                                                                                              |
| `wording`                                      | TEXT            | Shown to adopters; frozen into each snapshot.                                                                                                               |
| `answer_type`                                  | TEXT            | `text`, `long_text`, `yes_no`, `choice`, `multi_choice`, `number`, `date`, `phone`, `email`, `address`, `contact`, `group`, `repeat`, `repeat_field`, `pet` |
| `choices`                                      | JSONB           | `[{"value","label"}]` for choice types.                                                                                                                     |
| `fields`                                       | JSONB           | `[{"key","label","type"}]` for `address`, `contact`, `group`, `repeat`, `repeat_field`.                                                                     |
| `follow_up`                                    | JSONB           | `{"when":[…],"label":…}`; conditional text box.                                                                                                             |
| `show_if`                                      | JSONB           | `{"question","in":[…]}` or `{"question","gt":n}`; only ask when another answer matches (e.g. landlord questions only for renters).                          |
| `parent_id`                                    | TEXT FK         | Set only on `repeat_field` rows: extra per-row fields a rescue can add to a `repeat` question (e.g. `pet.current.vaccines`).                                |
| `species`                                      | TEXT            | `any`, `dog`, `cat`.                                                                                                                                        |
| `pet_tag`                                      | TEXT            | Pet-specific group tag, or NULL.                                                                                                                            |
| `sensitivity`                                  | TEXT            | `normal`, `sensitive`, `third_party`.                                                                                                                       |
| `is_locked`, `is_flaggable`, `always_optional` | BOOLEAN         | From the PRP.                                                                                                                                               |
| `retired_at`                                   | TIMESTAMPTZ     | Retired questions can't be newly shown.                                                                                                                     |

RLS: readable by everyone (it is form content); no client writes (admins edit via SQL).

### `shelter_application_questions` (a rescue's choices)

`(shelter_id, question_id)` PK, `shown BOOLEAN`, `updated_at`. No row means hidden, except locked questions, which are always shown. Readable by signed-in users (an adopter must know which questions to answer); **no client writes in phase 1** (phase 2 adds a manager-only RPC).

### `adopter_answers` (saved answers, answer once)

`(adopter_id, question_id)` PK, `value JSONB`, `updated_at`. Strictly own-row for SELECT/INSERT/UPDATE/DELETE. Staff have no policy and can never read it.

### `applications.answers_snapshot`

New nullable JSONB array column. Each entry: `{question_id, category, wording, answer_type, choices, fields, value}`. NULL for applications submitted before this feature (they keep `profile_snapshot`).

### Answer value shapes

| Answer type                          | `value`                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `text`, `long_text`, `email`, `date` | JSON string                                                                                    |
| `yes_no`                             | JSON boolean                                                                                   |
| `number`                             | JSON number                                                                                    |
| `choice`                             | choice `value` string                                                                          |
| `multi_choice`                       | array of choice values                                                                         |
| `phone`                              | `{"number","type"}`                                                                            |
| `address`                            | `{"street","unit","city","state","zip"}`                                                       |
| `contact`                            | `{"name","phone","note"}`                                                                      |
| `group`                              | `{"<field key>": …}`                                                                           |
| `repeat`                             | `{"rows":[{…}], "legacy_note"?}`; rows also hold the keys of any shown `repeat_field` children |
| `pet`                                | `{"pet_id","name"}`, filled by the database from the applied-for pet                           |
| any with follow-up                   | add `"explain"` (string)                                                                       |

`trn.experience_level` (choice + describe) uses `{"level","describe"}`.

### Carry-over mapping (today's profile → saved answers)

| Profile column                            | Question                                | Value                                                                                                        |
| ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `full_name`                               | `con.full_name`                         | string                                                                                                       |
| `phone`                                   | `con.phone`                             | `{"number":phone,"type":null}`                                                                               |
| `address_line`, `city`, `state`, `zip`    | `con.address`                           | `{"street","city","state","zip"}`                                                                            |
| `housing_type`                            | `hou.home_type`                         | `own_house`/`rent_house` → `house`; `own_condo` → `condo`; `rent_apartment` → `apartment`; `other` → `other` |
| `housing_type`                            | `hou.own_rent`                          | `own_*` → `own`; `rent_*` → `rent`; `other` → not set                                                        |
| `landlord_approval`                       | `hou.landlord_allows`                   | `true` → `yes`, `false` → `no`                                                                               |
| `landlord_contact`                        | `hou.landlord_contact`                  | `{"note":text}` (free text today)                                                                            |
| `has_yard`                                | `yrd.has_yard`                          | boolean                                                                                                      |
| `yard_fenced`                             | `yrd.fenced`                            | `true` → `fully`, `false` → `no`                                                                             |
| `household_adults` / `household_children` | `hh.adults_count` / `hh.children_count` | number                                                                                                       |
| `other_pets`                              | `pet.current`                           | `{"rows":[],"legacy_note":text}`                                                                             |
| `vet_name`, `vet_phone`                   | `vet.contact`                           | `{"name","phone"}`                                                                                           |
| `experience`                              | `trn.experience_level`                  | `{"level":null,"describe":text}`                                                                             |

A NULL/blank column produces no answer, and clears a previously synced one.

### Database functions and triggers

- `adopter_profile_answers(adopter_profiles)` — pure mapping above.
- `sync_adopter_profile_answers()` — AFTER INSERT/UPDATE on `adopter_profiles`: upserts mapped answers and deletes mapped answers whose column is now blank. Keeps saved answers current while today's form is the only form.
- `build_application_answers_snapshot(adopter, shelter, pet, why)` — SECURITY DEFINER, not callable by clients. Selects non-retired questions that are locked **or** shown by the shelter, filtered to `species IN ('any', pet.species)` and `pet_tag IS NULL` (tags arrive in phase 2). Values come from `adopter_answers`, except per-application questions (`app.pet_interest` from the pet, `app.why_this_pet` from the application) and `con.email` (account email).
- `set_application_answers_snapshot()` — BEFORE INSERT on `applications`: always overwrites `answers_snapshot` with the built snapshot, so a client cannot add or remove answers.
- One-time backfill: `INSERT … SELECT` from every `adopter_profiles` row, `ON CONFLICT DO NOTHING`.

## Project structure (files touched)

```
supabase/migrations/20251006_complete_monolithic_setup.sql   # new "Configurable application (#337)" section
src/types/applications.ts                                     # AnswerSnapshotEntry, Application.answers_snapshot
src/lib/supabase/types.ts                                     # new tables + column
tests/rls/application-answers-rls.test.ts                     # privacy + carry-over tests
features/core-features/049-configurable-application/          # spec, plan, tasks
```

## Rollout

1. Merge-ready code with unit tests green.
2. Product owner approves applying to the live database.
3. Apply the new section via the Management API in one transaction; reload the PostgREST schema cache.
4. Verify: row counts (`adopter_answers` covers every profile), then `pnpm test:rls`.
5. Open the PR.

**Rollback**: the section only adds objects. Dropping the trigger on `applications` restores today's behaviour exactly; the new tables can stay unused.

## Risks

| Risk                                               | Mitigation                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot trigger fails and blocks every submission | Function is defensive (missing pet/answers produce NULL values, never an error); RLS test submits through it; rollback is one `DROP TRIGGER`. |
| Bank seed mistakes                                 | Seed is `ON CONFLICT DO UPDATE`, so wording fixes are a re-run; ids are what matter and come from the PRP.                                    |
| Sync trigger writes the wrong user's rows          | Writes only `NEW.id`; SECURITY DEFINER with fixed `search_path`.                                                                              |
