# RescueDogs Business Model

**Purpose:** Draft revenue and sustainability strategy for a mission-driven rescue
product. RescueDogs may operate as a nonprofit, but it still needs a clear path to
cover hosting, development, and shelter support. This doc pairs with
[VISION.md](./VISION.md) (what we build) and the
[constitution](../../.specify/memory/constitution.md) (what we must not violate).

**Status:** Draft for team discussion — pricing and structure are illustrative, not
final.

**Related docs:**

- [Product vision & roadmap](./VISION.md)
- [Constitution (Principles I–V)](../../.specify/memory/constitution.md)
- [Rescue MVP spec (as shipped)](../../features/core-features/048-rescue-mvp/spec.md)

---

## Positioning (one sentence)

> RescueDogs is the anti-ghosting operating system for shelters — we don't help
> people browse pets; we help rescues finish adoptions with less volunteer burnout
> and more applicant trust.

This is **B2B shelter SaaS** (and grant-funded mission work), not a Petfinder-style
consumer listing business.

The possible long-term expansion described in
[VISION.md — Future horizons](./VISION.md#future-horizons-possible-additions-after-pillars-15)
does not change the near-term position. If validated later, RescueDogs could
grow from the shelter operating system into a **federated animal-services
network** for adoption, reunion, and ongoing support. That expansion must be
earned through completed workflows and trusted partnerships—not listing volume
or advertising traffic.

---

## Organizational structure options

Structure does not determine whether you can earn revenue; it shapes how you raise
and report it.

| Structure                           | Best when…                                                     | Typical revenue                                                              |
| ----------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **501(c)(3) nonprofit**             | Mission-first; grants and tax-deductible donations are central | Grants, donations, **program service fees** (charging shelters for software) |
| **Public benefit / B Corp LLC**     | Flexibility plus mission accountability                        | Subscriptions, partnerships, mixed funding                                   |
| **For-profit with mission charter** | Faster scale; outside investment                               | SaaS subscriptions, integrations                                             |

**Common pattern in rescue tech:** nonprofit or B Corp, with **shelters as
customers** and **adopters never charged to apply or track status**.

---

## Who pays (and who doesn't)

| Actor                          | Pays?                       | Rationale                                                                   |
| ------------------------------ | --------------------------- | --------------------------------------------------------------------------- |
| **Shelters / rescue networks** | Yes (primary)               | They save volunteer time and reduce ghosting — measurable operational value |
| **Grantmakers / sponsors**     | Yes (non-dilutive)          | Fund free tier for small rescues or regional rollout                        |
| **Adopters**                   | No for core loop            | Application + status tracker must stay frictionless (Constitution I, III)   |
| **Adopters (optional)**        | Voluntary tip/donation only | After success — never a paywall                                             |

**Core rule:** monetize **time saved for shelters** and **outcomes for animals**,
not **access for applicants**.

---

## Constitution-aligned revenue principles

These align with Principles I–IV and constrain some common startup playbooks.

| Do                                                                        | Don't                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Charge shelters for pipeline tools that replace email/phone status checks | Sell, share, or profile applicant PII (Principle III)                         |
| Offer transparent optional donations after adoption success               | Pay-to-apply or pay-to-track status                                           |
| Measure success by placements and response time                           | Optimize for DAU, ad impressions, or engagement vanity metrics (Principle IV) |
| Disclose any fee on donations or adoption payments clearly                | Dark patterns that pressure adopters (Principle IV)                           |
| Keep staff workflows under ~5 minutes to learn (Principle II)             | Features that add daily data entry without returning more time                |

---

## Revenue streams

### Tier A — Near-term (aligns with current MVP, pillar 3)

#### 1. Shelter subscription (primary engine)

Freemium → paid tiers. Illustrative pricing — validate with pilot shelters.

| Tier        | Audience                   | Price (draft) | Includes                                                                       |
| ----------- | -------------------------- | ------------- | ------------------------------------------------------------------------------ |
| **Free**    | Tiny foster-only groups    | $0            | 1 user, capped active applications, basic tracker                              |
| **Shelter** | Single-site rescues        | $49–149/mo    | Full pipeline, unlimited applications, staff seats (3–5), status notifications |
| **Network** | Multi-site / umbrella orgs | $299–799/mo   | Multi-shelter dashboard, shared applicant pool, reporting, API access          |

**Value proposition:** fewer "what's my status?" emails, faster triage, applicants
stay engaged through honest updates → more completed adoptions.

For a **501(c)(3)**, subscription revenue is typically **program service revenue**
(software that directly supports the charitable mission).

#### 2. Implementation / onboarding (one-time)

$500–2,500 per shelter: setup, staff training, data import from spreadsheets or
legacy tools. Especially important early when product-led growth is limited.

#### 3. Grants

Target funders focused on **shelter burnout**, **adoption completion**, and
**transparency** — not "another pet search directory."

Potential angles:

- Reduced applicant ghosting (time-to-first-response, status visibility)
- Volunteer hour savings (email/call volume before vs after)
- Placement quality and return-rate tracking (as product matures)

Examples of funder categories: animal welfare foundations, regional community
foundations, corporate CSR programs in pet care.

#### 4. Optional donor support (adopter-side)

After **Approved** or successful adoption: optional "Support RescueDogs" — one-click,
**opt-in only**. Never required to use the tracker or apply.

---

### Tier B — Medium-term (after pillar 3 is proven with real shelters)

#### 5. Verified universal profile (add-on for shelters)

Automated landlord / vet / reference checks as a **paid tier feature**. Shelters
pay because verification saves volunteer hours; adopters still do not pay to apply.

#### 6. Integrations and API

Paid connections to shelter management systems, Petfinder sync, accounting for
adoption fees. Priced as integration packages or included in **Network** tier.

#### 7. Adoption fee processing

Shelter collects adoption fees through the platform; RescueDogs takes a small
**processing margin** (e.g. payment processor pass-through plus modest platform
fee). Shelter keeps the majority; fees must be disclosed.

#### 8. Mission-aligned sponsorships

Pet insurance, veterinary networks, or food brands sponsor **free tier for small
rescues** or **"Powered by X" on shelter dashboards** — never applicant data sales,
never required consumer purchases.

---

### Tier C — Long-term (future pillars from [VISION.md](./VISION.md))

| Pillar                          | Revenue idea (when built)                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Foster ecosystem**        | Premium foster-to-adopt workflows; partnerships on foster kits or weekend-foster insurance                                                        |
| **2 — Stray rescue network**    | Municipal / county contracts for coordinated stray intake (B2G)                                                                                   |
| **4 — Post-adoption retention** | Network-tier "pet parent mode"; transparent small platform fee on community medical crowdfunding; insurer partnerships tied to lower return rates |
| **5 — Lifestyle matching**      | Paid match analytics and re-engagement when a pet is adopted elsewhere ("3 similar matches")                                                      |

Per Constitution **Principle V**, do not build Tier C revenue features until pillar 3
is validated in production with at least one real shelter.

---

### Tier D — Far-future horizons (not committed)

These models correspond to the possible additions documented in
[VISION.md](./VISION.md#future-horizons-possible-additions-after-pillars-15).
They are hypotheses for later customer and partner discovery, not forecasts or
approval to build.

#### 9. Human–animal wellness organization network

Potential customers and partners include qualified equine programs,
animal-assisted wellness organizations, therapeutic riding programs, and
post-adoption behavioral or grooming providers.

Possible sustainable models:

- Organization subscriptions for verified profiles, referral intake, scheduling
  tools, and outcome reporting
- Program-service grants supporting access for veterans, trauma survivors, or
  other eligible communities
- Institution or health-system partnerships that fund qualified referrals
- Transparent booking or referral fees only when they do not influence rankings
  or restrict access

**Required guardrails:** RescueDogs must not market non-clinical services as
medical treatment, sell health-related data, or store diagnoses merely to
facilitate discovery. Credential verification, animal-welfare standards,
insurance, safeguarding, and legal review are prerequisites.

#### 10. Microchip identity and reunion network

The strongest initial model is likely **B2B/B2G infrastructure**, not a consumer
fee. Veterinarians, shelters, municipalities, animal-control agencies, and
participating registries benefit from faster routing and fewer manual calls.

Possible sustainable models:

- API or enterprise access for high-volume professional lookup workflows
- Municipal or regional contracts tied to reunion speed and reduced shelter
  intake
- Registry integration, implementation, and support agreements
- Grants or mission-aligned sponsorships that keep public lost-pet lookup free

**Required guardrails:** Never charge a pet owner to recover contact with a
found pet, sell chip-linked identity data, scrape registries without permission,
or expose owner contact details when a privacy-preserving relay is sufficient.
Commercial viability depends on registry participation, standards, and formal
data-sharing agreements.

#### 11. Federated animal-services hub

The hub should monetize workflow and coordination value—not access to a
pay-to-play directory.

Possible sustainable models:

- Organization subscriptions for verified profiles, referrals, case handoffs,
  and service availability
- Regional network contracts for coordinated care and reporting
- Integration/API fees for participating platforms
- Grants or sponsorships that fund verified listings in underserved areas

Search placement and welfare recommendations must not be sold to the highest
bidder. If sponsorship exists, it must be clearly labeled and separated from
verification, relevance, and safety ranking.

#### Validation gates before Tier D

Before approving any Tier D business line:

1. Demonstrate that pillars 1–5 have created a real need for the proposed
   connection rather than assuming a general directory will attract users
2. Interview each side of the market and secure willing pilot partners
3. Map regulatory, privacy, credentialing, safeguarding, and insurance duties
4. Define an animal-outcome metric and a partner-time-saved metric
5. Prove that the model can operate without selling personal data or distorting
   referrals
6. Run one geographically limited pilot before claiming broad coverage

Per Constitution **Principle V**, Tier D begins only after the earlier loops have
been validated and deliberately prioritized. "Be the place for everything" is a
direction, not a release scope.

---

## What to avoid

| Avoid                                                | Why                                                  |
| ---------------------------------------------------- | ---------------------------------------------------- |
| Selling or profiling applicant data                  | Violates Principle III; destroys trust               |
| Selling owner, microchip, or health-related data     | Endangers people and animals; destroys network trust |
| Pay-to-apply or pay-to-track                         | Adds barrier; hurts adoptions                        |
| Pay-to-reunite a lost animal                         | Exploits an urgent welfare event                     |
| Pay-to-rank service organizations                    | Distorts referrals and safety signals                |
| Fees tied to rejection or ghosting                   | Perverse incentives                                  |
| Ad-heavy consumer experience                         | Optimizes traffic, not placements                    |
| Large undocumented cuts of animal-directed donations | Erodes shelter and adopter trust                     |

---

## Illustrative 3-year path

Numbers are **draft** for planning conversations, not forecasts.

### Year 1 — Prove the loop

- **Customers:** 5–10 pilot shelters (discounted or free)
- **Revenue:** grants plus 2–3 paying pilots (~$500–1,500/mo total)
- **Goal:** case study — e.g. "% reduction in status inquiry emails" and "days to
  first staff response"

### Year 2 — SaaS plus grants

- **Customers:** 30–50 paying shelters @ ~$99/mo average → ~$3k–5k MRR
- **Revenue:** subscriptions, 1–2 implementation packages per quarter, one
  foundation grant ($25k–100k range as illustration)

### Year 3 — Network tier and add-ons

- **Customers:** 100+ sites (mix of Shelter and Network tiers) → ~$10k–25k MRR
- **Revenue:** verification add-on, adoption fee processing, 1–2 network or
  municipal deals

**Nonprofit variant:** same economics; surplus reinvested into free tier for tiny
rescues and pilot expansion.

---

## Customer segments

| Segment                             | Need                             | Product fit today                             |
| ----------------------------------- | -------------------------------- | --------------------------------------------- |
| **Small foster-based rescue**       | Low overhead, few volunteers     | Free or Shelter tier; pipeline + tracker      |
| **Brick-and-mortar shelter**        | High application volume, burnout | Shelter tier; status dropdown replaces emails |
| **Regional network / umbrella org** | Consistency across sites         | Network tier (future); shared standards       |
| **Grantmakers**                     | Measurable welfare outcomes      | Fund pilots and free tier access              |
| **Corporate sponsors**              | Brand alignment with rescue      | Sponsor free seats; no consumer data deals    |

Possible far-future segments—animal-assisted wellness organizations,
veterinarians, microchip registries, municipalities, and other animal-service
providers—remain discovery targets rather than current customers.

---

## Metrics that matter (for pricing and grants)

Align with Constitution **Principle IV** — animal outcomes, not vanity metrics.

| Metric                                               | Why funders and shelters care                 |
| ---------------------------------------------------- | --------------------------------------------- |
| Median time to first staff response                  | Direct anti-ghosting signal                   |
| % applications with status update within 7 days      | Pipeline health                               |
| Applicant withdrawal rate vs completion rate         | Experience quality                            |
| Staff-reported hours on status emails (before/after) | Principle II — time returned                  |
| Placement stick rate (90-day returns)                | Long-term outcome; needs post-adoption pillar |

---

## Open decisions (team to resolve)

- [ ] Nonprofit vs B Corp vs for-profit (legal and tax advice required)
- [ ] Pilot pricing: free forever vs 90-day trial vs discounted year one
- [ ] Whether adoption fee processing is in scope for v1 commercial features
- [ ] Sponsorship ethics policy (who we will and won't partner with)
- [ ] Geographic focus: hyper-local pilots vs nationwide from day one

---

## Revision history

| Date       | Change                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| 2026-07-11 | Added business analysis and guardrails for possible post-pillar horizons |
| 2026-07-04 | Initial draft from product/strategy discussion                           |
