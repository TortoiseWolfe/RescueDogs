# First-partner shelter onboarding (ops runbook)

**Tracking:** [#138](https://github.com/TortoiseWolfe/RescueDogs/issues/138),
[#218](https://github.com/TortoiseWolfe/RescueDogs/issues/218)
**Audience:** Raised Paws operators (not public site copy)
**Goal:** A real (non-demo) shelter/rescue row + staff membership so someone can
sign in and upload pets at `/shelter/pets`.

**Self-serve (#218):** signed-in users who are not already staff can create one
rescue at `/shelter` (`create_my_shelter` RPC). This SQL runbook remains for
demo repair and support.

Related: [VISION.md](./VISION.md) (pilot pet load), [PILOT-AGREEMENT.md](./PILOT-AGREEMENT.md)
(partner-facing ask), [FIRST-PARTNER-ZOOM-RUNBOOK.md](./FIRST-PARTNER-ZOOM-RUNBOOK.md)
(live onboarding), [FIRST-PARTNER-ZOOM-HANDOUT.md](./FIRST-PARTNER-ZOOM-HANDOUT.md)
(partner one-pager).

---

## What you need

| Item                    | Notes                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Supabase project        | Production Raised Paws (`SUPABASE_PROJECT_REF` in `.env`)                           |
| `SUPABASE_ACCESS_TOKEN` | [Account tokens](https://supabase.com/dashboard/account/tokens) — local `.env` only |
| Auth user               | Staff must **already have** an account on raisedpaws.com (sign up once)             |
| Shelter facts           | Name, city, state, zip, contact email                                               |

**Not required for new users:** operator SQL — they can create a rescue in-app
after sign-up. Petfinder sync and CSV import are still out of scope.

---

## Product rules (do not skip)

1. Uploading pets requires a **shelter staff** login (`shelter_members`). Adopter
   accounts cannot manage pets.
2. Demo (`staff@demo.test` / Second Chance Rescue) is for sales and CI — not for
   partner pets.
3. Early pilots: partner sends photos + short fields (email / shared folder);
   operator or linked staff uploads in-app.
4. Prefer **currently available** animals only (often ~5–30).

---

## Steps (Management API)

Load env (from repo root):

```bash
set -a
source <(grep -E '^(SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_REF)=' .env | sed 's/\r$//')
set +a
```

Helper (paste once per shell):

```bash
sb_query() {
  curl -sS -X POST \
    "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(python -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<< "$1")}"
}
```

### 1. Confirm the staff Auth user exists

```bash
EMAIL='their-or-your@email.com'   # must already be registered on the site
sb_query "SELECT id::text, email FROM auth.users WHERE lower(email) = lower('${EMAIL}');"
```

If empty: have them **Create Account** on raisedpaws.com (or local), then re-run.
Copy the `id` UUID — that is `user_id`.

### 2. Create the shelter row (idempotent UUID)

Pick a stable UUID per partner so re-runs do not duplicate. Example for the
internal pilot org already provisioned in #138:

| Field                    | Pilot value                                  |
| ------------------------ | -------------------------------------------- |
| `id`                     | `22222222-2222-2222-2222-222222222202`       |
| `name`                   | Raised Paws Pilot Shelter                    |
| `city` / `state` / `zip` | Asheville / NC / 28801 (replace per partner) |
| `contact_email`          | `contact@raisedpaws.com` (or partner inbox)  |

```bash
sb_query "
INSERT INTO shelters (id, name, city, state, zip, contact_email) VALUES
  ('22222222-2222-2222-2222-222222222202',
   'Raised Paws Pilot Shelter', 'Asheville', 'NC', '28801', 'contact@raisedpaws.com')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  contact_email = EXCLUDED.contact_email;
"
```

### 3. Link staff (`shelter_members`)

```bash
USER_ID='…uuid from step 1…'
SHELTER_ID='22222222-2222-2222-2222-222222222202'

sb_query "
INSERT INTO shelter_members (shelter_id, user_id, role) VALUES
  ('${SHELTER_ID}', '${USER_ID}', 'manager')
ON CONFLICT (shelter_id, user_id) DO UPDATE SET role = EXCLUDED.role;
"
```

Roles: `staff` or `manager` (both pass `is_shelter_staff()` for pet upload).

### 4. Smoke test in the app

1. Sign out of any demo session.
2. Sign in at `/sign-in?portal=shelter` with the **linked** email (not
   `staff@demo.test`).
3. Open `/shelter` — shelter name should show in the chrome.
4. Open `/shelter/pets` → **Add pet** → JPEG/PNG/WebP ≤ 5MB → save.
5. Confirm the pet appears on `/dogs` or `/cats` (and state/zip filters if set).

If you see **“No shelter access on this account”**: membership insert failed or
you are on the wrong Auth user.

### 5. Hand off to the partner (optional)

- Same steps with **their** shelter name + **their** staff emails.
- Do not put demo passwords in partner email.
- Point them at `/for-shelters` and the private pilot Doc/PDF
  ([PILOT-AGREEMENT.md](./PILOT-AGREEMENT.md)).

---

## Checklist (copy per partner)

- [ ] Auth user exists for each staff email
- [ ] `shelters` row (name, city, state, zip, contact)
- [ ] `shelter_members` for each staff (`staff` or `manager`)
- [ ] At least one available pet + photo via `/shelter/pets`
- [ ] Visible on `/dogs` or `/cats`
- [ ] Staff can open `/shelter` pipeline
- [ ] Shelter application email notify configured ([#260](https://github.com/TortoiseWolfe/RescueDogs/issues/260))
- [ ] Partner packet / check-in scheduled

---

## Shelter application email (#260)

When a new application is submitted, staff receive email at `shelters.contact_email`
via the `notify-shelter-application` Edge Function (Resend + pg_net trigger).

### One-time deploy (ops)

1. Deploy the function and secrets (from repo root, inside Docker):

```bash
docker compose exec rescuedogs supabase functions deploy notify-shelter-application --project-ref "$NEXT_PUBLIC_SUPABASE_PROJECT_REF"
docker compose exec rescuedogs supabase secrets set \
  APPLICATION_NOTIFY_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  RESEND_API_KEY="re_…" \
  --project-ref "$NEXT_PUBLIC_SUPABASE_PROJECT_REF"
```

Also ensure `RESEND_API_KEY` and `NEXT_PUBLIC_DEPLOY_URL=https://raisedpaws.com`
are set on the function (inherit from project secrets / dashboard).

2. Apply new monolithic SQL (pg_net trigger + config table) via Management API
   if not already on the project — same flow as other schema changes.

3. Wire the trigger (replace URL and secret with your values):

```bash
EDGE_URL="https://${NEXT_PUBLIC_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/notify-shelter-application"
WEBHOOK_SECRET="…same as APPLICATION_NOTIFY_WEBHOOK_SECRET…"

sb_query "
UPDATE private.shelter_application_notify_config
SET
  edge_function_url = '${EDGE_URL}',
  webhook_secret = '${WEBHOOK_SECRET}',
  updated_at = NOW()
WHERE id = 1;
"
```

4. Smoke test: submit a demo application → email arrives at shelter `contact_email`.

Until step 3 is done, the trigger no-ops safely; staff still use `/shelter`.

---

## Out of scope (still deferred)

- Self-serve create/join shelter
- Bulk CSV / Petfinder sync
- Multi-photo galleries
- `/follow` early-interest list (#129)

---

## Revision

| Date       | Change                                                         |
| ---------- | -------------------------------------------------------------- |
| 2026-08-03 | Initial runbook + Raised Paws Pilot Shelter provisioned (#138) |
