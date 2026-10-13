# PRP: Configurable Adoption Application — Master Question Bank (Step 0)

## Problem Statement

**Date**: 2026-10-12
**Status**: Draft, revised with product-owner decisions 2026-10-12 (step 0, documents only)
**Issue**: [#337](https://github.com/TortoiseWolfe/RescueDogs/issues/337)
**Scope of this document**: the master question list, its metadata, and which questions the two pilot partners would select. No schema, code, or migration changes. Those are steps 1–4 of #337.

Both pilot partners use longer applications than our universal form. #337 keeps the core promise (an adopter answers each question once, ever) by turning the application into a **shared master question bank**. Each rescue sees every question, grouped by category, and shows or hides single questions or whole categories; the **locked core** (today's application) is always on. Rescues may **flag** answers that matter to them; Raised Paws never rejects anyone automatically.

### Sources reviewed

The partner and public applications were collected into a local-only reference folder. That folder is never committed because it holds the rescues' own documents and contact details. This PRP contains no staff names or contact details.

| Code | Source                                                                                                        | Kind                                       |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| CUR  | Raised Paws current form (`AdopterProfile` + `why_this_pet`)                                                  | Our baseline                               |
| SSD  | Sunnyside Street Dogs (73 questions; `Q` numbers refer to their form)                                         | Pilot partner, dogs                        |
| OUP  | Once Upon A Prayer Rescue (~40 fields)                                                                        | Pilot partner                              |
| SON  | Sonoma County Animal Services                                                                                 | County shelter, dogs, short                |
| PGH  | PAWS of Grays Harbor                                                                                          | Small shelter, dogs, medium                |
| CAWS | CAWS cat adoption (partial capture)                                                                           | Cats                                       |
| GU   | Greyhounds Unlimited                                                                                          | Breed rescue                               |
| LD   | Lucky Dog Animal Rescue                                                                                       | Foster-based, dogs and cats                |
| CRU  | Cats R Us Feline Rescue                                                                                       | Cats                                       |
| SM   | San Marcos Regional Animal Shelter                                                                            | City shelter, all species                  |
| BF   | Best Friends open-adoption guidance                                                                           | Not an application; argues for short forms |
| NCS  | **Not from a collected source.** Common in senior and bully-breed rescue applications; proposed for the bank. | —                                          |

## Design rules this list follows

1. **One wording per question.** Duplicates across sources are merged, including duplicates inside one form (SSD Q50 = Q65; SSD Q23 ≈ Q71; SSD Q43 ≈ Q45).
2. **Locked core = the questions on today's application.** They are always on and cannot be hidden, so no rescue's application gets shorter than it is now. Locked means always shown, not necessarily required; whether a question is required is a separate setting (later enhancement, per the issue).
3. **Flags only on structured answers** (yes/no, choice, number, date, counts). Free text is never flagged, because there is nothing to evaluate it against without a human reading it.
4. **Flag, never auto-reject.** A flag is a dashboard badge. Staff decide.
5. **A rescue never sees an answer to a question it did not select** (Principle III), and never sees a flag derived from one.
6. **Species tag** controls visibility: `dog` questions show only on dog applications, `cat` only on cat applications, `any` always.
7. **Follow-ups are part of the question**, not separate questions: "Yes/No + explain if yes" is one id with a conditional text field.
8. **Per-application questions** (the pet applied for, "why this pet", "how did you hear about us") are answered fresh on each application and are never reused across rescues.
9. **Agreements and eligibility statements are not questions.** They are listed separately below and are per rescue.

### Column key

- **Answer type**: `text` (one line), `long` (paragraph), `yes/no`, `choice(…)` (pick one), `multi(…)` (pick any), `number`, `date`, `phone`, `email`, `repeat{…}` (add a row per item). `+explain if yes` / `+explain if no` / `+describe if Other` are conditional follow-ups.
- **Species**: `dog`, `cat`, `any`.
- **Sens.** (sensitivity): `—` normal adopter data; `Yes` sensitive about the adopter (health, minors' ages, government ID, criminal history, finances, employer); `3P` personal data about a **third party** (landlord, references). Sensitive questions need explicit retention rules before collection (open decision 2).
- **Core**: `Y` locked core (always on, cannot be hidden).
- **Flag**: `Y` a rescue can choose to flag an answer to this question.

---

## Master question list

### 1. Contact

| ID                      | Question                                     | Answer type                          | Species | Sens. | Core | Flag | Sources                              |
| ----------------------- | -------------------------------------------- | ------------------------------------ | ------- | ----- | ---- | ---- | ------------------------------------ |
| `con.full_name`         | Full name                                    | text                                 | any     | —     | Y    | N    | CUR, SSD, OUP, SON, PGH, LD, CRU, SM |
| `con.email`             | Email address                                | email (from account)                 | any     | —     | Y    | N    | SSD Q10, OUP, SON, PGH, LD, CRU, SM  |
| `con.email_secondary`   | Secondary email (optional)                   | email                                | any     | —     | N    | N    | SSD Q11                              |
| `con.phone`             | Primary phone and type                       | phone + choice(Mobile / Home / Work) | any     | —     | Y    | N    | CUR, SSD Q8, OUP, SON, LD, CRU, SM   |
| `con.phone_secondary`   | Secondary phone and type (optional)          | phone + choice(Mobile / Home / Work) | any     | —     | N    | N    | SSD Q9, OUP, SON, SM                 |
| `con.address`           | Home address: street, unit, city, state, ZIP | text group                           | any     | —     | Y    | N    | CUR, SSD Q2–7, OUP, SON, LD, CRU, SM |
| `con.county`            | County                                       | text                                 | any     | —     | N    | N    | SSD Q6                               |
| `con.mailing_address`   | Mailing address, if different                | text group                           | any     | —     | N    | N    | SON                                  |
| `con.preferred_contact` | Preferred way to contact you                 | choice(Email / Phone call / Text)    | any     | —     | N    | N    | PGH                                  |

**This application (answered fresh each time, never reused):**

| ID                      | Question                                   | Answer type                                                                                                          | Species | Sens. | Core | Flag | Sources                                      |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | -------------------------------------------- |
| `app.pet_interest`      | Which pet(s) are you applying for?         | pet picker (this rescue's listings)                                                                                  | any     | —     | Y    | N    | CUR, SSD Q12, OUP, PGH, LD, CRU, SM          |
| `app.why_this_pet`      | Why this pet?                              | long                                                                                                                 | any     | —     | Y    | N    | CUR, CRU ("Why do you want to adopt a cat?") |
| `app.heard_about`       | How did you hear about us?                 | choice(Petfinder / Adopt-a-Pet / Facebook / Instagram / Friend or family / Other website / Other) +describe if Other | any     | —     | N    | N    | SSD Q72–73, PGH, GU                          |
| `app.adopted_from_us`   | Have you adopted from us before?           | yes/no +explain if yes (when, which pet)                                                                             | any     | —     | N    | N    | SON, CAWS                                    |
| `app.surrendered_to_us` | Have you ever surrendered an animal to us? | yes/no +explain if yes                                                                                               | any     | —     | N    | Y    | SON                                          |

### 2. Eligibility

| ID                         | Question                                                                   | Answer type                                                                                          | Species | Sens. | Core | Flag | Sources                                               |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ----------------------------------------------------- |
| `elg.date_of_birth`        | Date of birth                                                              | date. Rescue sees **age and whether it meets its own minimum**, not the date.                        | any     | Yes   | N    | Y    | OUP, LD, SM; SSD Q13 asks age; PGH asks "18 or over?" |
| `elg.cruelty_conviction`   | Have you ever been convicted of abuse or neglect of a child or an animal?  | yes/no +explain if yes                                                                               | any     | Yes   | N    | Y    | PGH; SM (as a certification statement)                |
| `elg.application_rejected` | Have you ever had an adoption application rejected by a rescue or shelter? | yes/no +explain if yes                                                                               | any     | Yes   | N    | Y    | CRU                                                   |
| `elg.government_id`        | Driver's licence or ID number                                              | text. **Not recommended**: prefer the "ID showing current address" statement and check ID in person. | any     | Yes   | N    | N    | SM                                                    |

### 3. Household

| ID                       | Question                                                                                                            | Answer type                                                           | Species | Sens. | Core | Flag | Sources                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ---------------------------------------- |
| `hh.adults_count`        | How many adults live in your home?                                                                                  | number                                                                | any     | —     | Y    | N    | CUR, SSD Q30, SON, PGH, CRU, SM          |
| `hh.children_count`      | How many children live in your home?                                                                                | number                                                                | any     | —     | Y    | Y    | CUR, SSD Q31, SON, PGH, CRU, SM          |
| `hh.members`             | Everyone who lives in your home: relationship to you and age                                                        | repeat{relationship, age}                                             | any     | Yes   | N    | Y    | SSD Q1 + Q32, OUP, SON, PGH, LD, CRU, SM |
| `hh.all_agree`           | Does every adult in your home know you are applying and agree to the adoption?                                      | yes/no +explain if no                                                 | any     | —     | N    | Y    | SSD Q23 + Q71, PGH, GU                   |
| `hh.primary_caregiver`   | Who will be the pet's primary caregiver?                                                                            | text                                                                  | any     | —     | N    | N    | SSD Q29, SON, CAWS                       |
| `hh.allergies`           | Does anyone in your home have pet allergies or asthma?                                                              | yes/no +explain if yes                                                | any     | Yes   | N    | Y    | SSD Q34, CRU                             |
| `hh.children_experience` | Describe your children's experience with pets and how you will supervise them together. Shown only if children > 0. | long                                                                  | any     | Yes   | N    | N    | SSD Q33                                  |
| `hh.visitors`            | Who visits your home regularly?                                                                                     | long                                                                  | any     | —     | N    | N    | SON                                      |
| `hh.pet_for`             | Who is this pet for?                                                                                                | choice(Me / My household / Someone else, as a gift) +describe if gift | any     | —     | N    | Y    | PGH, CAWS, CRU, SM                       |

### 4. Housing & Landlord

| ID                      | Question                                                                                                    | Answer type                                                                                     | Species | Sens. | Core | Flag | Sources                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ------------------------------------------------------------ |
| `hou.home_type`         | What type of home do you live in?                                                                           | choice(House / Townhouse / Apartment / Condo / Duplex / Mobile home / Other) +describe if Other | any     | —     | Y    | Y    | CUR, SSD Q24–25, OUP, SON, PGH, GU, LD, CRU, SM              |
| `hou.own_rent`          | Do you own or rent your home?                                                                               | choice(Own / Rent / Live with family or other) +describe if other                               | any     | —     | Y    | Y    | CUR, SSD Q26, SON, PGH, GU, LD, CRU, SM                      |
| `hou.landlord_allows`   | If you rent: does your landlord allow this pet? Shown only if renting.                                      | choice(Yes / No / Not asked yet)                                                                | any     | —     | Y    | Y    | CUR, SSD Q28, GU (dog over 50 lb); OUP and SON as statements |
| `hou.landlord_contact`  | If you rent: landlord or property manager name and phone (and complex name, if any). Shown only if renting. | text + phone                                                                                    | any     | 3P    | Y    | Y    | CUR, SSD Q27, OUP, SON, PGH, GU, LD, CRU, SM                 |
| `hou.restrictions`      | Does your landlord, HOA, or neighborhood have pet restrictions?                                             | yes/no +if yes: max pets, size/weight limit, breed restrictions, deposits or fees, other        | any     | —     | N    | Y    | SSD Q15–19, LD, SM                                           |
| `hou.insurance_breed`   | Does your homeowner's or renter's insurance restrict any breeds or sizes?                                   | choice(Yes / No / Don't know) +explain if yes                                                   | dog     | —     | N    | Y    | **NCS**                                                      |
| `hou.breed_legislation` | Does your city or county have breed-specific legislation or restrictions?                                   | choice(Yes / No / Don't know) +explain if yes                                                   | dog     | —     | N    | Y    | **NCS**                                                      |
| `hou.area_type`         | What type of area do you live in?                                                                           | choice(Urban / Suburban / Rural)                                                                | any     | —     | N    | N    | GU                                                           |
| `hou.time_at_address`   | How long have you lived at your current address?                                                            | choice(Under 1 year / 1–3 years / 3+ years)                                                     | any     | —     | N    | N    | CRU                                                          |
| `hou.moving_soon`       | Do you expect to move in the next 6 months?                                                                 | yes/no                                                                                          | any     | —     | N    | Y    | CRU                                                          |
| `hou.neighbor_issues`   | Have you had any issues with neighbors about pets?                                                          | yes/no +explain if yes                                                                          | any     | —     | N    | Y    | CAWS                                                         |

### 5. Yard & Containment

| ID                        | Question                                                      | Answer type                                                                                                                       | Species | Sens. | Core | Flag | Sources                               |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ------------------------------------- |
| `yrd.has_yard`            | Do you have a yard?                                           | yes/no                                                                                                                            | any     | —     | Y    | Y    | CUR, SM                               |
| `yrd.fenced`              | Is your yard fully fenced? Shown only if yard.                | choice(Fully / Partly / No)                                                                                                       | any     | —     | Y    | Y    | CUR, SSD Q20, OUP, SON, PGH, GU, LD   |
| `yrd.fence_details`       | Fence height and type. Shown only if fenced.                  | text (height) + choice(Wood / Chain-link / Vinyl / Wrought iron / Other)                                                          | dog     | —     | N    | N    | SSD Q21, OUP, SON, PGH, GU            |
| `yrd.other_containment`   | Do you use any other outdoor containment?                     | multi(None / Underground or electric fence / Outdoor kennel or dog run / Tie-out or chain / Other) +describe how it would be used | dog     | —     | N    | Y    | SSD Q22, SON, PGH, LD                 |
| `yrd.no_fence_plan`       | If you don't have a fenced yard, how will the dog go outside? | long                                                                                                                              | dog     | —     | N    | N    | PGH, GU                               |
| `yrd.outdoor_supervision` | How will you supervise the pet's time outdoors?               | long                                                                                                                              | any     | —     | N    | N    | SSD Q48                               |
| `yrd.indoor_outdoor`      | Will the pet live indoors, outdoors, or both?                 | choice(Indoors / Outdoors / Both)                                                                                                 | any     | —     | N    | Y    | OUP, PGH, SM; GU and LD as agreements |
| `yrd.cat_outdoor_access`  | Will your cat go outdoors? How often?                         | choice(Never / Screened porch or catio only / Supervised / Free access) +hours per day                                            | cat     | —     | N    | Y    | CAWS, LD                              |
| `yrd.pet_door`            | Will the pet have access to a pet door?                       | choice(Yes / No / In the future)                                                                                                  | any     | —     | N    | N    | CAWS, LD                              |
| `yrd.window_screens`      | Do your windows have screens?                                 | choice(Yes / No / Some)                                                                                                           | cat     | —     | N    | Y    | CAWS                                  |

### 6. Current & Past Pets

Current pets are one repeating group. Each health detail is its own id, so a rescue can select it (and flag it) independently.

| ID                           | Question                                                                        | Answer type                                                                                                                                                          | Species | Sens. | Core | Flag | Sources                                                                |
| ---------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ---------------------------------------------------------------------- |
| `pet.current`                | Pets living in your home now, including pets that belong to roommates or family | repeat{name, species, breed, age, sex} (zero rows allowed)                                                                                                           | any     | —     | Y    | N    | CUR (`other_pets` text), SSD Q35, OUP, SON, PGH, GU, CAWS, LD, CRU, SM |
| `pet.current.spay_neuter`    | Is this pet spayed or neutered? (per pet, dogs and cats)                        | yes/no +explain if no                                                                                                                                                | any     | —     | N    | Y    | SSD Q35, OUP, SON, PGH, CAWS, CRU                                      |
| `pet.current.vaccines`       | Is this pet current on vaccinations? (per pet)                                  | yes/no +explain if no                                                                                                                                                | any     | —     | N    | Y    | OUP, PGH, CAWS                                                         |
| `pet.current.heartworm`      | Is this dog on heartworm prevention? (per dog)                                  | yes/no +explain if no                                                                                                                                                | dog     | —     | N    | Y    | OUP                                                                    |
| `pet.current.microchip`      | Is this pet microchipped? (per pet)                                             | yes/no                                                                                                                                                               | any     | —     | N    | N    | CAWS                                                                   |
| `pet.current.declawed`       | Is this cat declawed? (per cat)                                                 | yes/no                                                                                                                                                               | cat     | —     | N    | Y    | CAWS, LD                                                               |
| `pet.current.details`        | How long you've had this pet and where it's kept (per pet)                      | text + choice(Indoors / Outdoors / Both)                                                                                                                             | any     | —     | N    | N    | CAWS, CRU                                                              |
| `pet.current.food`           | Type and brand of food (per pet)                                                | text                                                                                                                                                                 | any     | —     | N    | N    | CAWS                                                                   |
| `pet.current_adjust`         | How do you think your current pets will adjust to a new pet?                    | long                                                                                                                                                                 | any     | —     | N    | N    | CRU, GU (cat friendliness)                                             |
| `pet.past`                   | Pets you've owned in the past 5 years that no longer live with you              | repeat{name, species, age, when they left, what happened: choice(Died / Rehomed / Returned to a rescue or shelter / Lost / Other) +explain; if died, cause if known} | any     | —     | N    | Y    | SSD Q35–36, OUP, SON (past breeds), CAWS, LD, CRU                      |
| `pet.ever_given_up`          | Have you ever given up, rehomed, or returned a pet?                             | yes/no +if yes: what happened, what you tried first, where the pet went                                                                                              | any     | —     | N    | Y    | SSD Q38, OUP, PGH, LD                                                  |
| `pet.euthanized_non_medical` | Have you ever had a pet euthanized for reasons other than illness or old age?   | yes/no +explain if yes                                                                                                                                               | any     | Yes   | N    | Y    | PGH                                                                    |
| `pet.adopted_before`         | Have you adopted from a rescue or shelter before?                               | yes/no +which group(s)                                                                                                                                               | any     | —     | N    | N    | SSD Q37, CRU                                                           |
| `pet.moved_with_pets`        | Have you moved with pets before? What happened?                                 | choice(Haven't moved with pets / Took them with me / Gave to friend or family / Took to a shelter)                                                                   | any     | —     | N    | Y    | CAWS                                                                   |

### 7. Veterinarian

| ID              | Question                                                   | Answer type                            | Species | Sens. | Core | Flag | Sources                                       |
| --------------- | ---------------------------------------------------------- | -------------------------------------- | ------- | ----- | ---- | ---- | --------------------------------------------- |
| `vet.contact`   | Current or previous veterinarian or clinic: name and phone | text + phone (or "I don't have a vet") | any     | 3P    | Y    | Y    | CUR, SSD Q39, OUP, PGH, GU, CAWS, LD, CRU, SM |
| `vet.how_long`  | How long have you used this vet?                           | text                                   | any     | —     | N    | N    | CAWS                                          |
| `vet.need_help` | If you don't have a vet, would you like help finding one?  | yes/no                                 | any     | —     | N    | N    | SM                                            |

`vet.contact` is a business contact rather than a private person, but it is marked `3P` because rescues use it to call and verify the adopter's pet history.

### 8. References

| ID             | Question                                                                | Answer type                                                   | Species | Sens. | Core | Flag | Sources                                     |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- | ------- | ----- | ---- | ---- | ------------------------------------------- |
| `ref.personal` | Personal references who can speak about you as a pet owner or caregiver | repeat{name, phone, relationship, how long they've known you} | any     | 3P    | N    | Y    | SSD Q40 (three), OUP (three, non-relatives) |

Per-rescue settings on `ref.personal`: **minimum number** (0–3) and **non-relatives only** (yes/no). The flag fires when the adopter gives fewer than the rescue's minimum ("No references"). Retention of reference data is open decision 2 and must be settled before this question ships.

### 9. Lifestyle & Schedule

| ID                      | Question                                                                                                                                         | Answer type                                                                                                | Species | Sens. | Core | Flag | Sources                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | --------------------------------------------- |
| `lif.hours_alone`       | On a typical day, how many hours will the pet be home alone?                                                                                     | number                                                                                                     | any     | —     | N    | Y    | SSD Q46, OUP, SON, PGH, CAWS, LD, CRU         |
| `lif.where_when_away`   | Where will the pet stay when nobody is home?                                                                                                     | choice(Loose in the house / One room / Crate / Yard / Garage / Other) +describe if Other                   | any     | —     | N    | Y    | SSD Q49, OUP, SON, PGH (garage), CAWS, CRU    |
| `lif.sleep`             | Where will the pet sleep at night?                                                                                                               | choice(Bedroom / Elsewhere in the house / Crate / Garage / Outdoors / Other) +describe if Other            | any     | —     | N    | Y    | SSD Q47, SON, PGH, GU, CAWS, CRU              |
| `lif.schedule`          | Describe your work or school schedule, including whether you work from home and how long you're usually away                                     | long                                                                                                       | any     | —     | N    | N    | SSD Q14, LD                                   |
| `lif.employment_status` | Employment status                                                                                                                                | choice(Full-time / Part-time / Self-employed or work from home / Student / Retired / Not employed / Other) | any     | Yes   | N    | N    | PGH                                           |
| `lif.employer`          | Employer or school, and occupation                                                                                                               | text                                                                                                       | any     | Yes   | N    | N    | LD, CRU                                       |
| `lif.typical_day`       | What would a typical day look like with your pet?                                                                                                | long                                                                                                       | any     | —     | N    | N    | OUP                                           |
| `lif.activity_level`    | How active is your home?                                                                                                                         | choice(Very active / Moderately active / Quiet)                                                            | any     | —     | N    | N    | SON                                           |
| `lif.lifestyle`         | Describe your lifestyle (for example: travel, stay-at-home parent, retired, active)                                                              | long                                                                                                       | any     | —     | N    | N    | SON                                           |
| `lif.exercise`          | How will you exercise the dog, and how often?                                                                                                    | long                                                                                                       | dog     | —     | N    | N    | SON, PGH, GU, LD                              |
| `lif.furniture`         | Will the pet be allowed on furniture?                                                                                                            | choice(Yes / No / Some furniture)                                                                          | any     | —     | N    | N    | SSD Q44                                       |
| `lif.care_when_away`    | Who will care for the pet when you travel?                                                                                                       | choice(Family or friend / Pet sitter / Boarding / Travels with me / Other) +describe if Other              | any     | —     | N    | N    | PGH, CRU                                      |
| `lif.emergency_plan`    | What arrangements will you make for the pet in an emergency?                                                                                     | long                                                                                                       | any     | —     | N    | N    | PGH                                           |
| `lif.moving_plan`       | If you move, what will you do with the pet?                                                                                                      | choice(Pet moves with me / Not sure / Other) +describe                                                     | any     | —     | N    | Y    | PGH, CRU, SM                                  |
| `lif.future_changes`    | Any major life changes you expect in the next 5–10 years (moving, children, career)?                                                             | long                                                                                                       | any     | —     | N    | N    | LD                                            |
| `lif.costs_responsible` | Who in your household pays for vet care, emergencies, food, training, and grooming?                                                              | text                                                                                                       | any     | —     | N    | N    | SSD Q70                                       |
| `lif.budget`            | Basic care for a {species} can cost about ${amount} a year, not including emergencies. Are you able to take on that cost? Amount set per rescue. | yes/no                                                                                                     | any     | Yes   | N    | Y    | SON, CAWS, CRU (asks for an estimate instead) |
| `lif.truck_bed`         | If you drive a pickup truck, would the dog ride in the bed?                                                                                      | choice(Yes / No / No truck)                                                                                | dog     | —     | N    | Y    | PGH                                           |
| `lif.litter_box`        | Where will the litter box be kept?                                                                                                               | text                                                                                                       | cat     | —     | N    | N    | CAWS, CRU                                     |
| `lif.declaw_plan`       | Are you planning to declaw?                                                                                                                      | choice(Yes / No / Unsure) +explain if Yes or Unsure                                                        | cat     | —     | N    | Y    | CAWS, CRU, LD                                 |
| `lif.food_plan`         | What food do you plan to feed?                                                                                                                   | text                                                                                                       | any     | —     | N    | N    | CRU                                           |

**What you're looking for** (matching questions, never flagged):

| ID                    | Question                                                                          | Answer type                                                                                                                                                          | Species | Sens. | Core | Flag | Sources                   |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ------------------------- |
| `lif.reason_adopting` | Main reason you want a pet                                                        | multi(Companion / Exercise buddy / Lap pet / Companion for another pet / Working or hunting dog / Service or emotional support animal / Other) +describe if Other    | any     | —     | N    | N    | SON, PGH, CAWS            |
| `lif.looking_for`     | What personality and traits are you looking for?                                  | multi(Active / Mellow / Playful / Affectionate / Lap-loving / Good with dogs / Good with cats / Good with kids / Single-pet / Shy, needs a friend / Other) +describe | any     | —     | N    | N    | SSD Q41, SON, PGH, LD, SM |
| `lif.preferences`     | Preferred size, age, and sex                                                      | choice groups (size: Small / Medium / Large / Extra large; age: Baby / Young / Adult / Senior; sex: Male / Female / No preference)                                   | any     | —     | N    | N    | SON, GU, LD               |
| `lif.assistance_role` | Will this pet need to be trained as a service animal or emotional support animal? | choice(No / Service animal / Emotional support animal)                                                                                                               | any     | Yes   | N    | N    | LD, SON                   |
| `lif.anything_else`   | Anything else we should know?                                                     | long                                                                                                                                                                 | any     | —     | N    | N    | GU                        |

### 10. Training & Experience

| ID                     | Question                                                                                                                                | Answer type                                                                                                                                                                                       | Species | Sens. | Core | Flag | Sources                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ----------------------------------------- |
| `trn.experience_level` | Your experience with this kind of pet                                                                                                   | choice(Beginner: first one as an adult / Moderate: 1–2 as an adult, some basic training / Advanced: several, including behavior challenges / Raised puppies or kittens) +describe your experience | any     | —     | Y    | N    | CUR (`experience` text), SON, OUP, GU, SM |
| `trn.decompression`    | How long do you expect to give a newly adopted pet to settle in (decompress)?                                                           | choice(A few days / 1–2 weeks / 3–4 weeks / 1–3 months / As long as it takes) +explain                                                                                                            | any     | —     | N    | Y    | SSD Q50 + Q65 (duplicate)                 |
| `trn.adjustment_signs` | What changes in behavior would you consider normal while the pet adjusts, and when would you seek help?                                 | long                                                                                                                                                                                              | any     | —     | N    | N    | SSD Q52                                   |
| `trn.crate`            | What is your experience with crate training, and how will you use a crate?                                                              | long                                                                                                                                                                                              | dog     | —     | N    | N    | SSD Q42, GU                               |
| `trn.house_training`   | How would you handle house-training, accidents, or regression?                                                                          | long                                                                                                                                                                                              | any     | —     | N    | N    | SSD Q43 + Q45, PGH                        |
| `trn.destructive`      | How would you handle destructive behavior?                                                                                              | long                                                                                                                                                                                              | any     | —     | N    | N    | PGH                                       |
| `trn.behavior_plan`    | If a behavior problem comes up that's difficult for your household, what would you do?                                                  | long                                                                                                                                                                                              | any     | —     | N    | N    | SSD Q51, CRU, SM                          |
| `trn.methods`          | What training methods and tools would you use, and any you would not? Would you work with a trainer or behavior professional if needed? | long + yes/no (trainer)                                                                                                                                                                           | any     | —     | N    | N    | SSD Q53 + Q67                             |
| `trn.obedience_class`  | If you plan to take an obedience class, where?                                                                                          | text                                                                                                                                                                                              | dog     | —     | N    | N    | SSD Q54                                   |
| `trn.hard_behaviors`   | Which pet behaviors would be hardest for you to live with?                                                                              | multi(Barking / Chewing / House-soiling / Jumping / Shyness or fear / Separation anxiety / Scratching furniture / Not good with other pets / Other) +describe                                     | any     | —     | N    | Y    | SSD Q63, SON, LD, CAWS                    |
| `trn.want_to_learn`    | I'd like to learn more about… (supportive, never flagged)                                                                               | multi(Crate training / House training / Litter box training / Finding a vet / Heartworm / Obedience training / Pet insurance / Caring for my new pet)                                             | any     | —     | N    | N    | SM                                        |
| `trn.ready_when`       | How soon are you ready to bring your new pet home?                                                                                      | choice(Right away / Within 2 weeks / Within a month / Flexible)                                                                                                                                   | any     | —     | N    | N    | SSD Q55                                   |

### 11. Scenarios

Open-ended "what would you do" questions. Most come from one partner's form, but they are shared-bank questions that any rescue can show; like every other category, a rescue can hide the whole category at once. All except `scn.give_up_reasons` are `long` text, so they can't be flagged; staff read them.

| ID                        | Question                                                                                                                                              | Answer type                                                                                                                                                                                                                                                         | Species | Sens. | Core | Flag | Sources                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ---- | ---- | ------------------------- |
| `scn.give_up_reasons`     | What would make you consider giving up or returning a pet?                                                                                            | multi(Chewing or destructive / Not house-trained / Medical issues / Not getting along with other pets / Not good with children / Escaping / Moving / Pet gets too big / New baby / Landlord issues / Allergies / Bit someone / Nothing / Other) +please be specific | any     | —     | N    | Y    | SSD Q60, OUP, PGH, SM, LD |
| `scn.growl_child`         | Two weeks in, your dog growls when a child pulls its ears. What would you do?                                                                         | long                                                                                                                                                                                                                                                                | dog     | —     | N    | N    | SSD Q56                   |
| `scn.rough_start`         | Three weeks in, the pet has had accidents, chewed something valuable, and still isn't settled. How would you handle it?                               | long                                                                                                                                                                                                                                                                | any     | —     | N    | N    | SSD Q57                   |
| `scn.life_change`         | If your living situation or household changed (move, new baby, marriage or divorce, job change, deployment), what would you do with your pet?         | long                                                                                                                                                                                                                                                                | any     | —     | N    | N    | SSD Q58 + Q66, CRU        |
| `scn.unexpected_behavior` | The pet shows a behavior you didn't expect (barking, fear, resource guarding, separation anxiety, trouble with another pet). What would you do first? | long                                                                                                                                                                                                                                                                | any     | —     | N    | N    | SSD Q59                   |
| `scn.vet_bill`            | Your vet recommends an unexpected treatment costing $1,000–$2,000. How would you approach it?                                                         | long                                                                                                                                                                                                                                                                | any     | —     | N    | N    | SSD Q61                   |
| `scn.frustration`         | Tell us about a time a pet frustrated you or surprised you. What happened and how did you handle it?                                                  | long                                                                                                                                                                                                                                                                | any     | —     | N    | N    | SSD Q62                   |
| `scn.resource_guarding`   | Your dog growls when you take away a toy, food, or other valued item. What would you do?                                                              | long                                                                                                                                                                                                                                                                | dog     | —     | N    | N    | SSD Q64                   |
| `scn.bite`                | Your pet bites or tries to bite a person or another animal. What would you do next?                                                                   | long                                                                                                                                                                                                                                                                | any     | —     | N    | N    | SSD Q68                   |

`scn.give_up_reasons` is a multi-choice so that a rescue can flag specific reasons (for example "Moving" or "New baby"). The explanation is still free text for staff to read.

### 12. Agreements

Agreements are **not questions** and are **never reused** across rescues. Each rescue picks from this catalog (and edits the wording to name itself). The adopter accepts them on each application. See the separate list below.

---

## Agreements catalog (per rescue)

| ID                       | Statement                                                                                                                    | Sources                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `agr.truthful`           | I certify that the information in this application is true and complete.                                                     | SSD, SON, PGH, GU, CRU, SM                     |
| `agr.untrue_forfeit`     | I understand that untrue information may result in forfeiting any pet adopted.                                               | PGH                                            |
| `agr.no_guarantee`       | I understand that this application does not guarantee adoption.                                                              | OUP, SON, PGH, LD, SM                          |
| `agr.verify`             | I give {rescue} permission to verify my information and to contact my landlord, veterinarian, and references.                | SON, PGH, CRU, SSD (process)                   |
| `agr.home_visit`         | I agree to a home visit (in person or by video) before placement.                                                            | OUP, GU, CRU, PGH (virtual, with photos), CAWS |
| `agr.lifelong`           | I am prepared for the lifelong commitment of pet ownership (a cat may live 15–20 years).                                     | OUP, CAWS                                      |
| `agr.return_to_rescue`   | If I can no longer keep the pet, I will contact {rescue} and return it rather than rehome it myself or take it to a shelter. | OUP, SSD Q69, GU, LD                           |
| `agr.indoor_only`        | The pet will live indoors as a house pet.                                                                                    | GU, LD                                         |
| `agr.spay_neuter`        | The pet must be (or remain) spayed or neutered.                                                                              | LD                                             |
| `agr.no_electric_fence`  | I will not use an electric fence.                                                                                            | LD                                             |
| `agr.no_tie_out`         | I will use a martingale collar and never tie the dog outside.                                                                | GU                                             |
| `agr.keep_id_tag`        | I will keep {rescue}'s ID tag on the pet at all times.                                                                       | GU                                             |
| `agr.keep_care_current`  | I will keep vaccinations, heartworm prevention, and dental care current.                                                     | GU                                             |
| `agr.notify_lost`        | I will notify {rescue} immediately if the pet is lost, stolen, or dies.                                                      | GU                                             |
| `agr.house_pet_only`     | The pet will never be used for racing, hunting, or research.                                                                 | GU                                             |
| `agr.reclaim_on_neglect` | If there is proof of neglect or abuse, {rescue} may reclaim the pet and all fees are forfeited.                              | GU                                             |
| `agr.part_of_contract`   | This application becomes part of the adoption contract.                                                                      | GU                                             |
| `agr.sign_contract`      | I am willing to sign legal adoption papers.                                                                                  | CRU                                            |
| `agr.fee_aware`          | I am aware of the adoption fee ({fee}) and that it is non-refundable.                                                        | CRU, SSD (process)                             |
| `agr.pickup_transport`   | I understand where the pet is located and the pickup or transport arrangements.                                              | LD, SSD (process)                              |
| `agr.photo_release`      | Optional: {rescue} may use a photo of me with my pet in its publications. Separate, optional consent.                        | SON                                            |
| `agr.signature`          | Electronic signature and date.                                                                                               | SSD, SON, CRU, SM                              |

## Eligibility statements (per rescue)

Statements the adopter confirms about themselves, rather than blanks to fill. They are separate from both questions and agreements.

| ID                          | Statement                                                                                                   | Sources                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `elg.stmt.min_age`          | I am at least {min_age} years old. Rescue sets the minimum (18 or 21). Checked against `elg.date_of_birth`. | OUP, SON, PGH, LD, SM (18); SSD (21, from partner feedback) |
| `elg.stmt.id_address`       | I have identification showing my current address.                                                           | OUP                                                         |
| `elg.stmt.landlord_consent` | If I rent, my landlord knows about and consents to this adoption.                                           | OUP, SON                                                    |
| `elg.stmt.time_to_care`     | I am able and willing to spend the time needed to care for the pet.                                         | OUP                                                         |
| `elg.stmt.no_cruelty`       | I have never been convicted of animal cruelty.                                                              | SM                                                          |
| `elg.stmt.local_pickup`     | I can pick up the pet locally ({area}).                                                                     | LD                                                          |

---

## Flags a rescue can turn on

Every flag is optional, off by default, and set per rescue. A flag shows as a badge on the dashboard only if the rescue asked the question.

| Flag badge (example)       | Question                                                           | Trigger (rescue chooses)                       |
| -------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| Under {min_age}            | `elg.date_of_birth`                                                | Age below the rescue's minimum                 |
| Gave up a pet before       | `pet.ever_given_up`, `pet.past`                                    | Yes; or any past pet rehomed or returned       |
| Short decompression        | `trn.decompression`                                                | Choices the rescue selects (e.g. "A few days") |
| Would give up for…         | `scn.give_up_reasons`                                              | Reasons the rescue selects                     |
| No references              | `ref.personal`                                                     | Fewer than the rescue's minimum                |
| Pets not spayed/neutered   | `pet.current.spay_neuter`                                          | Any current dog or cat "No"                    |
| Pets not vaccinated        | `pet.current.vaccines`                                             | Any current pet "No"                           |
| No heartworm prevention    | `pet.current.heartworm`                                            | Any current dog "No"                           |
| No landlord approval       | `hou.landlord_allows`                                              | "No" or "Not asked yet"                        |
| Housing restrictions       | `hou.restrictions`, `hou.insurance_breed`, `hou.breed_legislation` | Yes                                            |
| Apartment / renter         | `hou.home_type`, `hou.own_rent`                                    | Choices the rescue selects                     |
| No fenced yard             | `yrd.fenced`                                                       | "No" or "Partly"                               |
| Electric fence / tie-out   | `yrd.other_containment`                                            | Choices the rescue selects                     |
| Outdoor pet                | `yrd.indoor_outdoor`, `yrd.cat_outdoor_access`                     | Choices the rescue selects                     |
| Alone {n}+ hours           | `lif.hours_alone`                                                  | Above the rescue's threshold                   |
| Household not in agreement | `hh.all_agree`                                                     | No                                             |
| Young children             | `hh.children_count`, `hh.members`                                  | Any child, or child under the rescue's age     |
| Allergies                  | `hh.allergies`                                                     | Yes                                            |
| Gift                       | `hh.pet_for`                                                       | Someone else                                   |
| No vet                     | `vet.contact`                                                      | "I don't have a vet"                           |
| Conviction                 | `elg.cruelty_conviction`                                           | Yes                                            |
| Rejected before            | `elg.application_rejected`                                         | Yes                                            |
| Non-medical euthanasia     | `pet.euthanized_non_medical`                                       | Yes                                            |
| Declaw plan                | `lif.declaw_plan`, `pet.current.declawed`                          | Yes or Unsure                                  |
| Moving soon                | `hou.moving_soon`, `lif.moving_plan`, `pet.moved_with_pets`        | Choices the rescue selects                     |
| Budget concern             | `lif.budget`                                                       | No                                             |

---

## Pilot partner selections

**Sunnyside** is based on its 73-question form plus its make-or-break list from the 2026-10-11 meeting. **Once Upon a Prayer** is inferred from its current form only; that partner has not been interviewed yet, so its column needs confirming.

`Y` = would select. `+` = not on their form, but recommended because they already verify it some other way or listed it as make-or-break. `—` = not selected. Locked-core questions are on for everyone and omitted.

| Question                   | Sunnyside                                                                                        | Once Upon a Prayer                                                                                   | Notes                              |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `con.email_secondary`      | Y                                                                                                | —                                                                                                    |                                    |
| `con.phone_secondary`      | Y                                                                                                | Y                                                                                                    | OUP asks home and cell             |
| `con.county`               | Y                                                                                                | —                                                                                                    |                                    |
| `app.heard_about`          | Y                                                                                                | —                                                                                                    |                                    |
| `elg.date_of_birth`        | Y (flag under 21)                                                                                | Y (minimum 18)                                                                                       |                                    |
| `hh.members`               | Y                                                                                                | Y                                                                                                    |                                    |
| `hh.all_agree`             | Y                                                                                                | —                                                                                                    |                                    |
| `hh.primary_caregiver`     | Y                                                                                                | —                                                                                                    |                                    |
| `hh.allergies`             | Y                                                                                                | —                                                                                                    |                                    |
| `hh.children_experience`   | Y                                                                                                | —                                                                                                    |                                    |
| `hou.restrictions`         | Y                                                                                                | —                                                                                                    |                                    |
| `yrd.fence_details`        | Y                                                                                                | Y                                                                                                    |                                    |
| `yrd.other_containment`    | Y                                                                                                | —                                                                                                    |                                    |
| `yrd.outdoor_supervision`  | Y                                                                                                | —                                                                                                    |                                    |
| `yrd.indoor_outdoor`       | —                                                                                                | Y                                                                                                    |                                    |
| `pet.current.spay_neuter`  | Y (flag)                                                                                         | Y                                                                                                    |                                    |
| `pet.current.vaccines`     | + (flag)                                                                                         | Y                                                                                                    | Make-or-break for Sunnyside        |
| `pet.current.heartworm`    | +                                                                                                | Y                                                                                                    | Sunnyside checks this with the vet |
| `pet.past`                 | Y                                                                                                | Y                                                                                                    | OUP asks past pet types only       |
| `pet.ever_given_up`        | Y (flag)                                                                                         | Y                                                                                                    | Make-or-break for Sunnyside        |
| `pet.adopted_before`       | Y                                                                                                | —                                                                                                    |                                    |
| `ref.personal`             | Y (3, flag if none)                                                                              | Y (3, non-relatives)                                                                                 |                                    |
| `lif.hours_alone`          | Y                                                                                                | Y                                                                                                    |                                    |
| `lif.where_when_away`      | Y                                                                                                | Y                                                                                                    |                                    |
| `lif.sleep`                | Y                                                                                                | —                                                                                                    |                                    |
| `lif.schedule`             | Y                                                                                                | —                                                                                                    |                                    |
| `lif.typical_day`          | —                                                                                                | Y                                                                                                    |                                    |
| `lif.furniture`            | Y                                                                                                | —                                                                                                    |                                    |
| `lif.costs_responsible`    | Y                                                                                                | —                                                                                                    |                                    |
| `lif.looking_for`          | Y                                                                                                | —                                                                                                    |                                    |
| `trn.decompression`        | Y (flag)                                                                                         | —                                                                                                    | Make-or-break for Sunnyside        |
| `trn.adjustment_signs`     | Y                                                                                                | —                                                                                                    |                                    |
| `trn.crate`                | Y                                                                                                | —                                                                                                    |                                    |
| `trn.house_training`       | Y                                                                                                | —                                                                                                    |                                    |
| `trn.behavior_plan`        | Y                                                                                                | —                                                                                                    |                                    |
| `trn.methods`              | Y                                                                                                | —                                                                                                    |                                    |
| `trn.obedience_class`      | Y                                                                                                | —                                                                                                    |                                    |
| `trn.hard_behaviors`       | Y                                                                                                | —                                                                                                    |                                    |
| `trn.ready_when`           | Y                                                                                                | —                                                                                                    |                                    |
| `scn.give_up_reasons`      | Y (flag)                                                                                         | Y                                                                                                    | Make-or-break for Sunnyside        |
| `scn.growl_child`          | Y                                                                                                | —                                                                                                    |                                    |
| `scn.rough_start`          | Y                                                                                                | —                                                                                                    |                                    |
| `scn.life_change`          | Y                                                                                                | —                                                                                                    |                                    |
| `scn.unexpected_behavior`  | Y                                                                                                | —                                                                                                    |                                    |
| `scn.vet_bill`             | Y                                                                                                | —                                                                                                    |                                    |
| `scn.frustration`          | Y                                                                                                | —                                                                                                    |                                    |
| `scn.resource_guarding`    | Y                                                                                                | —                                                                                                    |                                    |
| `scn.bite`                 | Y                                                                                                | —                                                                                                    |                                    |
| **Agreements**             | `agr.truthful`, `agr.return_to_rescue`, `agr.signature`, `agr.fee_aware`, `agr.pickup_transport` | `agr.no_guarantee`, `agr.home_visit`, `agr.lifelong`, `agr.return_to_rescue`                         |                                    |
| **Eligibility statements** | `elg.stmt.min_age` (21)                                                                          | `elg.stmt.min_age` (18), `elg.stmt.id_address`, `elg.stmt.landlord_consent`, `elg.stmt.time_to_care` |                                    |

Notes on Sunnyside: `pet.current.vaccines` and `pet.current.heartworm` don't appear on its form. Its coordinator checklist confirms them by calling the vet, and vaccines are on its make-or-break list, so asking up front saves a step. Its home-and-property flags (apartment, renter, no fenced yard) stay off because it accepts apartments and no fence.

---

## Candidate custom questions (not in the master bank)

These came from a single source and are too breed- or rescue-specific to share. They belong in the later "Additional questions from this rescue" feature (#337 open decision 1), and their answers are not reused.

| Question                                                                                | Source                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------- |
| Stairs in the home, and what type (open back, cement, carpet)                           | GU                                          |
| Swimming pool or large body of water on the property                                    | GU                                          |
| Willing to crate or muzzle during the adjustment period                                 | GU                                          |
| Aware the dog must be leashed or in a fully fenced area                                 | GU                                          |
| Color or sex preference for a greyhound                                                 | GU                                          |
| Willing to buy a plastic cat carrier today                                              | CAWS                                        |
| Preference about whether the cat is already spayed or neutered                          | CAWS                                        |
| Your understanding of your responsibility to {rescue} if you can no longer keep the dog | SSD Q69 (covered by `agr.return_to_rescue`) |

---

## How a rescue builds its application

There are **no Small / Medium / Large presets**. Every rescue sees the whole master list, grouped into the categories above, and shows or hides single questions or whole categories (the −/+ screen in the 2026-10-12 comment on #337). Locked-core questions show a lock and can't be hidden.

**Locked core** (17 questions, exactly today's application):

`con.full_name`, `con.email`, `con.phone`, `con.address`, `app.pet_interest`, `app.why_this_pet`, `hou.home_type`, `hou.own_rent`, `hou.landlord_allows`, `hou.landlord_contact`, `yrd.has_yard`, `yrd.fenced`, `hh.adults_count`, `hh.children_count`, `pet.current`, `vet.contact`, `trn.experience_level`

**Starting state for a new rescue:** only the locked core is shown; every other question starts hidden (greyed out, with **+**). Reasons:

- Existing rescues' applications don't change until they add questions.
- A rescue that never opens settings can't accidentally publish the full list of about 115 questions.
- Adding the handful of questions a rescue cares about is quicker than hiding a hundred (Principle II). Showing a whole category, such as Scenarios, is one click.

**Adopter reuse:** an adopter answers each question once. On a later application they answer only the questions that rescue shows and they haven't answered yet; everything else is pre-filled and confirmed on the review step.

---

## Mapping the current form

Every current `AdopterProfile` field maps to a master-bank id, so existing answers carry over (open decision 3 covers the storage shape).

| Current field                                                | Master id                                   | Note                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `full_name`, `phone`, `address_line`, `city`, `state`, `zip` | `con.full_name`, `con.phone`, `con.address` | Direct                                                                                                                                    |
| `housing_type`                                               | `hou.home_type` + `hou.own_rent`            | Today's combined values (`own_house`, `rent_apartment`, …) split into two questions                                                       |
| `landlord_approval`                                          | `hou.landlord_allows`                       | Boolean becomes Yes / No / Not asked yet                                                                                                  |
| `landlord_contact`                                           | `hou.landlord_contact`                      | Direct                                                                                                                                    |
| `has_yard`, `yard_fenced`                                    | `yrd.has_yard`, `yrd.fenced`                | Fenced boolean becomes Fully / Partly / No                                                                                                |
| `household_adults`, `household_children`                     | `hh.adults_count`, `hh.children_count`      | Direct                                                                                                                                    |
| `other_pets`                                                 | `pet.current`                               | Free text can't be converted into rows. Keep it as a read-only legacy note and ask the adopter to fill in rows on their next application. |
| `vet_name`, `vet_phone`                                      | `vet.contact`                               | Direct                                                                                                                                    |
| `experience`                                                 | `trn.experience_level` (describe)           | Text goes into the describe field; the level choice starts blank                                                                          |
| `why_this_pet` (per application)                             | `app.why_this_pet`                          | Direct                                                                                                                                    |

---

## Decisions made (product owner, 2026-10-12)

1. **Locked core = today's application** (17 questions, listed above). `elg.date_of_birth`, `lif.hours_alone` and `lif.where_when_away` are optional; a rescue that wants an age flag shows `elg.date_of_birth`.
2. **No presets.** Rescues show or hide questions and categories from the full list.
3. **New rescues start with only the locked core shown.**
4. **Scenarios are shared-bank questions** any rescue can show, in one category that can be hidden as a whole.

## Open decisions for the product owner

1. **Landlord and vet retention** (`hou.landlord_contact`, `vet.contact`, both locked core and already collected today with no deletion rule). Options: keep each rescue's copy with the application indefinitely, or remove it from closed applications (adopted, withdrawn, denied) after a set period such as 90 days. The adopter's own saved copy stays editable either way.
2. **References** (`ref.personal`, private third parties). Options: reuse across rescues only after the adopter confirms "share these references with {rescue}?" on the review step; or never reuse and ask fresh each time. Either way, remove them from closed applications after a set period. Draft recommendation: confirm-on-review plus removal after closing. Must be decided before `ref.personal` ships.
3. **Criminal conviction** (`elg.cruelty_conviction`). Options: yes/no question with explanation; statement-only checkbox (`elg.stmt.no_cruelty`), which stores only the confirmation; or leave it out. Draft recommendation: statement only, since the answer is self-reported either way and stored criminal history is high-harm if leaked.
4. **Government ID number** (`elg.government_id`). Draft recommendation: remove it from the bank; staff check the physical ID at pickup or home visit, and `elg.stmt.id_address` covers the requirement.
5. **Non-medical euthanasia** (`pet.euthanized_non_medical`). Keep or leave out.
6. **Not-from-a-collected-source questions** (`hou.insurance_breed`, `hou.breed_legislation`). Confirm with the second pilot partner before including them.
7. **Once Upon a Prayer selections** need confirming at that partner's first meeting.

## Out of scope for step 0

- Schema, RLS, and storage for answers (step 1).
- The rescue settings −/+ screen and preview (steps 2–3; see the 2026-10-12 comment on #337).
- In-app follow-up questions after a first review (deferred by partner feedback).
- The per-stage staff checklist from Sunnyside's coordinator process (separate future ticket).

## References

- Tracking issue: [#337](https://github.com/TortoiseWolfe/RescueDogs/issues/337)
- Repository (MIT): https://github.com/TortoiseWolfe/RescueDogs
- Constitution: `.specify/memory/constitution.md` (Principles II, III, V)
- PRP process: `docs/prp-docs/SPECKIT-PRP-GUIDE.md`
- Best Friends Adoptions Training Playbook: https://bestfriends.org/network/resources-tools/adoptions-training-playbook
