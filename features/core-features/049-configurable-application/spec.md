# Feature Specification: Configurable Adoption Application

**Feature Branch**: `feat/337-question-settings-wireframe`
**Created**: 2026-10-13
**Status**: Draft
**Issue**: [#337](https://github.com/TortoiseWolfe/RescueDogs/issues/337)
**Input**: `docs/prp-docs/configurable-application-prp.md` (master question bank, product-owner decisions of 2026-10-12)

## UI Mockup

Signed off: 2026-10-14

- Builder: [`wireframes/01-application-questions.svg`](./wireframes/01-application-questions.svg) (light theme)
- Preview: [`wireframes/02-application-preview.svg`](./wireframes/02-application-preview.svg) (light theme)
- Red flag editor: [`wireframes/03-red-flag-editor.svg`](./wireframes/03-red-flag-editor.svg) (light theme)
- Pet tags on listing: [`wireframes/04-pet-tags.svg`](./wireframes/04-pet-tags.svg) (light theme)

These wireframes are spec constraints — implementation should match their layout, component structure, and interaction flow. Deviations require spec revision.

## Summary

Today every rescue on Raised Paws receives the same short application. Pilot partners ask many more questions on their own forms. This feature turns the application into a shared **master question bank**: each rescue chooses which questions its application shows, a **locked core** (today's application) is always shown, and rescues may mark answers as **red flags**. An adopter answers any question **once**; later applications ask only for questions that rescue shows and the adopter hasn't answered yet. A rescue never sees an answer to a question it did not ask.

The question content (wording, categories, which questions exist) is defined in the PRP. This spec defines the behaviour.

## Delivery phases

The feature ships in slices that match #337's plan. Each slice must leave the live site working.

| Phase | #337 step | Delivers                                                                                                                                                                             | Visible change                                                                       |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1     | Step 1    | Question bank, per-rescue configuration records, saved answers, application snapshots limited to the rescue's questions, carry-over of every existing adopter profile, privacy tests | None. The current form keeps working and its answers are also saved in the new form. |
| 2     | Step 2    | Rescue manager's −/+ settings screen, preview, red-flag choices, pet tags                                                                                                            | Rescue settings                                                                      |
| 3     | Step 3    | Adopter flow: only unanswered questions, "X of Y already answered", review step                                                                                                      | Adopter application                                                                  |
| 4     | Step 4    | Dashboard red-flag badges, third-party data removal job                                                                                                                              | Rescue dashboard                                                                     |

Phases 2–4 include screens, so they pass the wireframe review gate (`features/CLAUDE.md`) before planning. Phase 1 has no screens.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — An adopter answers each question once (Priority: P1)

An adopter who has applied to one rescue applies to a second rescue that asks more questions. They see their earlier answers pre-filled and are asked only for the new questions. Existing adopters' saved profiles carry over, so nobody re-enters what they already gave.

**Why this priority**: This is the product's core promise ("one application, filled out once") and the reason rescues and adopters choose Raised Paws.

**Independent Test**: Seed an adopter with saved answers to the locked core. Configure a rescue that also shows three extra questions. Start an application: exactly three questions are unanswered; everything else is pre-filled.

**Acceptance Scenarios**:

1. **Given** an adopter with a saved profile from today's form, **When** the new storage is introduced, **Then** every one of their existing answers is available as a saved answer with the same meaning, and nothing is lost.
2. **Given** an adopter who answered rescue A's 20 questions, **When** they apply to rescue B, which shows 25 questions including 18 of A's, **Then** they are asked only the 7 they haven't answered, and told "18 of 25 already answered".
3. **Given** an adopter applying to a rescue that asks fewer questions than they've answered, **When** they apply, **Then** they have no new questions to answer.
4. **Given** an adopter edits a saved answer, **When** they next apply anywhere, **Then** the edited answer is used; applications already submitted are unchanged.

---

### User Story 2 — A rescue sees only what it asked (Priority: P1)

A rescue reviewing an application sees answers only to the questions its application showed at the moment of submission. Answers the adopter saved for other rescues are never visible to it, in any screen, export, or data request.

**Why this priority**: Constitution Principle III. Answer reuse without this rule would leak adopters' information between rescues; reuse cannot ship without it.

**Independent Test**: Adopter answers 30 questions for rescue A, then applies to rescue B, which shows 17. Signed in as B's staff, every way of reading the application returns exactly those 17 answers; attempts to read the other 13 return nothing.

**Acceptance Scenarios**:

1. **Given** an application submitted to rescue B, **When** B's staff read it, **Then** they see exactly the questions B showed at submission time, with the adopter's answers as they were at submission.
2. **Given** the adopter has saved answers B did not ask, **When** B's staff try to read them by any means, **Then** they are refused.
3. **Given** B later changes its application, **When** B's staff reopen an earlier application, **Then** it still shows the questions and answers it was submitted with.
4. **Given** a red flag derived from a question B did not ask, **When** B views the application, **Then** no such flag appears.

---

### User Story 3 — A rescue manager builds its application (Priority: P2)

A rescue manager sees every question in the bank grouped by category. They show or hide single questions or whole categories; locked-core questions can't be hidden. After saving they see a preview exactly as an adopter will see it, and can return to edit at any time. A brand-new rescue starts with only the locked core shown.

**Why this priority**: Rescues need their own questions before the long-form pilot partners can move their applications onto Raised Paws, but adopters' reuse and privacy (P1) must exist first.

**Independent Test**: As a manager of a new rescue, show the Scenarios category and hide one scenario question, save, and check the preview lists the 17 locked questions plus the shown scenarios in order.

**Acceptance Scenarios**:

1. **Given** a new rescue, **When** a manager first opens application settings, **Then** only the locked-core questions are shown and every other question is hidden but listed.
2. **Given** a manager hides a category, **When** they show it again, **Then** the questions that were shown before hiding come back.
3. **Given** a locked-core question, **When** a manager tries to hide it, **Then** they can't; it shows as locked.
4. **Given** a staff member who is not a manager, **When** they open application settings, **Then** they can view but not change it, matching today's rescue settings.
5. **Given** a manager changes the application, **When** an adopter applies afterwards, **Then** the new application uses the changed questions; applications submitted before the change keep theirs.

---

### User Story 4 — A rescue marks answers as red flags (Priority: P2)

A rescue manager chooses which answers count as red flags for that rescue (for example "under 21", "gave up a pet before", "no references"). Applications with a red-flagged answer show a red-flag badge on the dashboard. Nothing is rejected automatically; staff decide and can ask the adopter about it.

**Why this priority**: Pilot partners' make-or-break items differ per rescue; this is how one shared bank serves both without built-in elimination rules.

**Independent Test**: A rescue red-flags "minimum age 21". An adopter aged 19 applies; the application shows the "Under 21" red flag and stays in the normal pipeline.

**Acceptance Scenarios**:

1. **Given** a rescue that red-flags an answer, **When** an application contains that answer, **Then** the dashboard shows a red-flag badge naming it.
2. **Given** a red-flagged application, **When** staff view it, **Then** every status is still available; the system never sets a status because of a red flag.
3. **Given** a rescue that has not turned on a red flag, **When** the same answer appears, **Then** no badge is shown.
4. **Given** a question with only free-text answers, **When** a manager looks for red-flag options, **Then** none are offered.

---

### User Story 5 — Pet-specific questions appear only for tagged pets (Priority: P3)

A rescue tags a pet's listing (for example "Sighthound" or "Senior") and shows the matching question group. Those questions appear only on applications for pets with that tag.

**Why this priority**: Valuable for breed and senior rescues, but not needed by either pilot partner's current form.

**Independent Test**: A rescue shows the Senior group and tags one pet "Senior". Applying for that pet includes the senior questions; applying for an untagged pet at the same rescue does not.

**Acceptance Scenarios**:

1. **Given** a shown group and a tagged pet, **When** an adopter applies for that pet, **Then** the group's questions are included.
2. **Given** the same rescue and an untagged pet, **When** an adopter applies, **Then** the group's questions are not included.
3. **Given** a pet-specific question answered for one pet, **When** the adopter applies for another tagged pet, **Then** the answer is reused like any other.

---

### User Story 6 — Third-party details are removed after an application closes (Priority: P3)

Landlord contact and personal references are removed from a rescue's copy of an application 90 days after it closes. Vet contact is removed 90 days after closing unless the pet was adopted. References are given to a new rescue only after the adopter confirms on the review step.

**Why this priority**: Landlords and references never agreed to be in Raised Paws. Lower priority only because references are not collected until the bank is live.

**Independent Test**: An application closed as "not selected" 91 days ago has no landlord, vet, or reference details in the rescue's copy; one adopted 91 days ago still shows the vet.

**Acceptance Scenarios**:

1. **Given** an application closed (adopted, not selected, or withdrawn) more than 90 days ago, **When** the rescue views it, **Then** landlord contact and references show as removed.
2. **Given** an application closed as adopted more than 90 days ago, **When** the rescue views it, **Then** the vet contact is still shown.
3. **Given** removal has happened, **When** the adopter views their own saved answers, **Then** their saved landlord, vet, and references are unchanged.
4. **Given** saved references, **When** an adopter applies to a rescue that asks for references, **Then** the references are copied into that application only if the adopter confirms sharing them.

### Edge Cases

- An adopter's saved answer no longer fits a changed question (for example a choice was renamed): the answer is treated as unanswered for new applications and kept as-is in old ones.
- A question is retired from the bank: rescues can no longer show it; submitted applications keep it.
- A dog-only question shown by a rescue: it appears only on applications for dogs; for cats it is skipped and not counted as unanswered.
- A conditional follow-up ("If yes, explain") whose trigger answer changes from yes to no: the follow-up answer is not sent with new applications.
- A rescue changes its questions while an adopter is mid-application: the adopter is shown the change on the review step before submitting.
- An adopter from before this feature with free-text "other pets": their text is kept and shown to them as a note, and they are asked to fill in structured pet rows on their next application.
- A repeating answer (current pets, references) with zero rows: valid; counts as answered.
- A rescue with no manager: its application stays at the locked core until a manager exists.

## Requirements _(mandatory)_

### Functional Requirements

**Question bank**

- **FR-001**: The system MUST hold one shared bank of questions, each with a stable identifier that never changes or gets reused, a category, wording, an answer type, a species (dog, cat, any), a sensitivity level, whether it is locked, whether it can be red-flagged, and whether it is always optional.
- **FR-002**: The system MUST support these answer types: short text, long text, yes/no, single choice, multiple choice, number, date, phone, email, and repeating groups of fields; and conditional follow-ups shown only for certain answers.
- **FR-003**: The locked core MUST be exactly the 17 questions listed in the PRP (today's application).
- **FR-004**: Only Raised Paws administrators may add, change, or retire bank questions. Rescues cannot edit bank wording.
- **FR-005**: Agreements and eligibility statements MUST be separate from questions, chosen per rescue, accepted per application, and never reused across rescues.

**Rescue configuration**

- **FR-006**: Each rescue MUST have its own record of which questions and categories it shows, and which answers it red-flags.
- **FR-007**: A new rescue MUST start with only the locked core shown.
- **FR-008**: Only a rescue's managers may change its configuration; other staff may view it.
- **FR-009**: Configuration changes MUST apply only to applications submitted after the change.

**Answers and reuse**

- **FR-010**: The system MUST store each adopter's answer to each question once, owned by the adopter and editable or deletable by them.
- **FR-011**: When an adopter starts an application, the system MUST determine which of the rescue's questions (for that pet's species and tags) the adopter has not answered, and ask only those.
- **FR-012**: Before submission, the adopter MUST be able to review and change every answer that will be sent.
- **FR-013**: Every existing adopter profile MUST be carried into saved answers with no loss, before or at the same time as any change that relies on saved answers.
- **FR-014**: Today's application form MUST keep working throughout phase 1, and its answers MUST be saved in the new form as well.
- **FR-015**: Every question a rescue shows MUST be answered before the adopter can submit, except questions the bank marks always-optional (for example secondary phone, secondary email, county). Locked-core questions keep today's required/optional behaviour. Conditional follow-ups are required only when their trigger answer is given. A repeating group with zero rows counts as answered.

**Privacy**

- **FR-016**: Each submitted application MUST contain a frozen copy of exactly the questions the rescue showed at submission (wording included) and the adopter's answers to them, and nothing else.
- **FR-017**: A rescue's staff MUST be unable to read any adopter answer except through the frozen copies of applications submitted to that rescue.
- **FR-018**: Red flags MUST be computed only from answers in the frozen copy.
- **FR-019**: Automated tests MUST prove FR-016 to FR-018 for each way staff can read data.

**Red flags**

- **FR-020**: A rescue manager MUST be able to turn red flags on or off per flaggable question, choosing which answers trigger them and, where relevant, a threshold (for example minimum age, maximum hours alone, minimum references).
- **FR-021**: A red flag MUST never change an application's status or block any action.
- **FR-022**: Red flags MUST be visible only to the rescue's staff, like internal notes. Adopters never see whether or why their application was red-flagged, in any screen, notification, or data request.

**Pet-specific questions**

- **FR-023**: Rescues MUST be able to tag pets with the tags listed in the PRP, and pet-specific question groups MUST appear only on applications for pets with a matching tag.

**Third-party data**

- **FR-024**: Landlord contact and references MUST be removed from a rescue's frozen copy 90 days after the application closes; vet contact likewise unless the application closed as adopted.
- **FR-025**: References MUST be copied into a new application only after the adopter confirms sharing them with that rescue.

### Key Entities

- **Question**: one entry in the shared bank (identifier, category, wording, answer type, choices, follow-ups, species, tag, sensitivity, locked, flaggable, retired).
- **Category**: a named group of questions in display order (Contact, Eligibility, Household, … Pet-specific).
- **Rescue application configuration**: per rescue, the shown/hidden state of each category and question, and the red-flag rules; changed only by managers.
- **Red-flag rule**: per rescue and question, the answers or threshold that raise the flag and the badge text.
- **Saved answer**: one adopter's current answer to one question; owned by the adopter.
- **Application snapshot**: the frozen questions and answers sent to one rescue for one application; the only adopter data a rescue can read.
- **Pet tag**: a label a rescue puts on a pet listing that switches on a pet-specific question group.
- **Agreement / eligibility statement**: per-rescue statements the adopter accepts on each application.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of existing adopter profiles carry over with every answer intact, verified by comparing each profile with its saved answers.
- **SC-002**: An adopter who has applied once answers zero repeated questions on any later application.
- **SC-003**: In privacy tests, a rescue reads 0 answers to questions it did not show, across every way staff can read data.
- **SC-004**: A rescue manager can set up an application (show categories, hide questions, preview) in under 5 minutes without instructions.
- **SC-005**: No application is ever rejected, hidden, or moved to another status because of a red flag.
- **SC-006**: During phase 1, adopters and rescues notice no change: the current form submits successfully and existing applications display as before.
- **SC-007**: After the 90-day window, 0 closed applications still hold landlord or reference details (or vet details, if not adopted).

## Assumptions

- Managers (not all staff) configure the application, matching today's rescue settings.
- Raised Paws administrators maintain the bank; the PRP's question list is the initial content. Open content decisions in the PRP (non-medical euthanasia question, questions not from a collected source, Once Upon a Prayer's selections) change data, not this behaviour.
- One application configuration per rescue; species and pet tags filter it per pet.
- Applications submitted before this feature keep their existing snapshot and remain readable.
- Per-rescue custom questions and in-app follow-up questions after review are out of scope (#337 open decision 1; deferred by partner feedback).
- The adopter's own saved answers are kept until they edit or delete them; account deletion removes them as it does today.

## Out of Scope

- Rescue-written custom questions.
- Sending extra questions to an adopter after the first review.
- Sunnyside's per-stage staff checklist (separate future ticket).
- Per-question "required" settings chosen by the rescue (FR-015 sets the rule for now).

## Clarifications

### Session 2026-10-13

- Q: When a rescue shows a question, must the adopter answer it to submit? → A: Yes, except questions the bank marks always-optional; locked core keeps today's behaviour (FR-015).
- Q: Should an adopter ever see that an answer red-flagged their application? → A: No; red flags are staff-only, like internal notes (FR-022).
