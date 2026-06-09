-- ============================================================================
-- RESCUEDOGS DEMO DATA — "Second Chance Rescue"
-- One fictional shelter, six pets, two demo accounts, three in-flight
-- applications at different stages so the dashboard and tracker have
-- realistic content on first sign-in.
-- Safe to re-run: fixed UUIDs + ON CONFLICT DO NOTHING.
-- Requires: the RescueDogs MVP schema (shelters/pets/applications/...)
-- from the monolithic migration.
--
-- Demo accounts (password for both: DemoPass123!)
--   adopter@demo.test — adopter with a saved profile + 3 applications
--   staff@demo.test   — shelter manager at Second Chance Rescue
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SHELTER
-- ============================================================================

INSERT INTO shelters (id, name, city, state, contact_email) VALUES
  ('22222222-2222-2222-2222-222222222201',
   'Second Chance Rescue', 'Asheville', 'NC', 'hello@secondchance.demo')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. DEMO USERS (same auth.users INSERT pattern as seed-admin-demo.sql)
-- ============================================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  -- Demo adopter
  ('33333333-3333-3333-3333-333333333301', '00000000-0000-0000-0000-000000000000',
   'adopter@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '20 days', now() - interval '20 days', now(),
   now() - interval '1 hour',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', ''),
  -- Demo shelter staff
  ('33333333-3333-3333-3333-333333333302', '00000000-0000-0000-0000-000000000000',
   'staff@demo.test', crypt('DemoPass123!', gen_salt('bf')),
   now() - interval '90 days', now() - interval '90 days', now(),
   now() - interval '30 minutes',
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated',
   '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- create_user_profile() trigger has already inserted bare profiles;
-- enrich them (same upsert style as seed-admin-demo.sql)
INSERT INTO user_profiles (id, username, display_name, welcome_message_sent)
VALUES
  ('33333333-3333-3333-3333-333333333301', 'demo-adopter', 'Dana Adopter', true),
  ('33333333-3333-3333-3333-333333333302', 'demo-staff', 'Sam Shelterworker', true)
ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      welcome_message_sent = EXCLUDED.welcome_message_sent;

-- Staff membership (manager at Second Chance Rescue)
INSERT INTO shelter_members (shelter_id, user_id, role) VALUES
  ('22222222-2222-2222-2222-222222222201',
   '33333333-3333-3333-3333-333333333302', 'manager')
ON CONFLICT (shelter_id, user_id) DO NOTHING;

-- ============================================================================
-- 3. PETS (five dogs + one cat; one already adopted to prove the
--    available-only dropdown filter)
-- ============================================================================

INSERT INTO pets (id, shelter_id, name, species, breed, sex, age_years, size, status) VALUES
  ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201',
   'Biscuit', 'dog', 'Labrador Mix', 'male', 2.0, 'large', 'available'),
  ('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222201',
   'Pepper', 'dog', 'Border Collie', 'female', 4.5, 'medium', 'available'),
  ('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222201',
   'Tank', 'dog', 'Pit Bull Terrier', 'male', 6.0, 'large', 'available'),
  ('44444444-4444-4444-4444-444444444404', '22222222-2222-2222-2222-222222222201',
   'Noodle', 'dog', 'Dachshund', 'female', 1.5, 'small', 'available'),
  ('44444444-4444-4444-4444-444444444405', '22222222-2222-2222-2222-222222222201',
   'Miso', 'cat', 'Domestic Shorthair', 'female', 3.0, 'small', 'available'),
  ('44444444-4444-4444-4444-444444444406', '22222222-2222-2222-2222-222222222201',
   'Rocket', 'dog', 'Greyhound', 'male', 5.0, 'large', 'adopted')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. ADOPTER PROFILE (the reusable "universal application" answers)
-- ============================================================================

INSERT INTO adopter_profiles (
  id, full_name, phone, address_line, city, state, zip,
  housing_type, landlord_approval, landlord_contact,
  has_yard, yard_fenced, household_adults, household_children,
  other_pets, vet_name, vet_phone, experience
) VALUES (
  '33333333-3333-3333-3333-333333333301',
  'Dana Adopter', '828-555-0142', '17 Maplewood Ln', 'Asheville', 'NC', '28801',
  'rent_house', true, 'Riverbend Property Mgmt, 828-555-0190',
  true, true, 2, 1,
  'One senior cat (Beans, 12, spayed, indoor)',
  'Haw Creek Animal Hospital', '828-555-0177',
  'Grew up with dogs; fostered two seniors for a local rescue in 2024.'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. APPLICATIONS (three in-flight at different stages)
--    INSERT fires on_application_created → initial 'submitted' history row.
--    Later stages are advanced with direct UPDATEs + history INSERTs because
--    this seed runs as the table owner (service/MCP), which has no auth.uid()
--    for the staff-guarded RPC. SEED-ONLY shortcut — the app always goes
--    through advance_application_status().
-- ============================================================================

-- 5a. Fresh application for Biscuit — still 'submitted'
INSERT INTO applications (id, adopter_id, pet_id, shelter_id, profile_snapshot, why_this_pet)
SELECT
  '55555555-5555-5555-5555-555555555501',
  '33333333-3333-3333-3333-333333333301',
  '44444444-4444-4444-4444-444444444401',
  '22222222-2222-2222-2222-222222222201',
  to_jsonb(ap) - 'id' - 'created_at' - 'updated_at',
  'Biscuit''s energy matches our hiking-every-weekend life, and our fenced yard is ready.'
FROM adopter_profiles ap WHERE ap.id = '33333333-3333-3333-3333-333333333301'
ON CONFLICT (id) DO NOTHING;

-- 5b. Application for Pepper — advanced to 'reference_check'
INSERT INTO applications (id, adopter_id, pet_id, shelter_id, profile_snapshot, why_this_pet)
SELECT
  '55555555-5555-5555-5555-555555555502',
  '33333333-3333-3333-3333-333333333301',
  '44444444-4444-4444-4444-444444444402',
  '22222222-2222-2222-2222-222222222201',
  to_jsonb(ap) - 'id' - 'created_at' - 'updated_at',
  'We work from home and want a smart, busy dog to train and run with.'
FROM adopter_profiles ap WHERE ap.id = '33333333-3333-3333-3333-333333333301'
ON CONFLICT (id) DO NOTHING;

UPDATE applications
SET status = 'reference_check', status_changed_at = now() - interval '1 day'
WHERE id = '55555555-5555-5555-5555-555555555502' AND status = 'submitted';

INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, note, created_at)
SELECT * FROM (VALUES
  ('55555555-5555-5555-5555-555555555502'::uuid, 'submitted', 'under_review',
   '33333333-3333-3333-3333-333333333302'::uuid,
   'Thanks Dana! Your application is in review.', now() - interval '3 days'),
  ('55555555-5555-5555-5555-555555555502'::uuid, 'under_review', 'reference_check',
   '33333333-3333-3333-3333-333333333302'::uuid,
   'Calling your vet and landlord this week.', now() - interval '1 day')
) AS v(application_id, from_status, to_status, changed_by, note, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM application_status_history
  WHERE application_id = '55555555-5555-5555-5555-555555555502'
    AND to_status = 'reference_check'
);

-- 5c. Application for Tank — closed as 'not_selected'
INSERT INTO applications (id, adopter_id, pet_id, shelter_id, profile_snapshot, why_this_pet)
SELECT
  '55555555-5555-5555-5555-555555555503',
  '33333333-3333-3333-3333-333333333301',
  '44444444-4444-4444-4444-444444444403',
  '22222222-2222-2222-2222-222222222201',
  to_jsonb(ap) - 'id' - 'created_at' - 'updated_at',
  'Tank looks like a gentle giant; we have room and patience for him.'
FROM adopter_profiles ap WHERE ap.id = '33333333-3333-3333-3333-333333333301'
ON CONFLICT (id) DO NOTHING;

UPDATE applications
SET status = 'not_selected', status_changed_at = now() - interval '5 days'
WHERE id = '55555555-5555-5555-5555-555555555503' AND status = 'submitted';

INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, note, created_at)
SELECT * FROM (VALUES
  ('55555555-5555-5555-5555-555555555503'::uuid, 'submitted', 'under_review',
   '33333333-3333-3333-3333-333333333302'::uuid,
   NULL, now() - interval '8 days'),
  ('55555555-5555-5555-5555-555555555503'::uuid, 'under_review', 'not_selected',
   '33333333-3333-3333-3333-333333333302'::uuid,
   'Another family with no other pets was a better fit for Tank. Pepper or Biscuit could be great matches for you!',
   now() - interval '5 days')
) AS v(application_id, from_status, to_status, changed_by, note, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM application_status_history
  WHERE application_id = '55555555-5555-5555-5555-555555555503'
    AND to_status = 'not_selected'
);

-- Normalize timeline: the on_application_created trigger stamps the initial
-- 'submitted' history row with now(); backdate it (and the application) so
-- the tracker timeline reads chronologically for the advanced applications.
UPDATE applications SET created_at = now() - interval '4 days'
  WHERE id = '55555555-5555-5555-5555-555555555502';
UPDATE application_status_history SET created_at = now() - interval '4 days'
  WHERE application_id = '55555555-5555-5555-5555-555555555502' AND to_status = 'submitted';
UPDATE applications SET created_at = now() - interval '9 days'
  WHERE id = '55555555-5555-5555-5555-555555555503';
UPDATE application_status_history SET created_at = now() - interval '9 days'
  WHERE application_id = '55555555-5555-5555-5555-555555555503' AND to_status = 'submitted';

COMMIT;

-- Verification summary
SELECT 'shelters' AS table_name, count(*) FROM shelters
UNION ALL SELECT 'shelter_members', count(*) FROM shelter_members
UNION ALL SELECT 'pets', count(*) FROM pets
UNION ALL SELECT 'adopter_profiles', count(*) FROM adopter_profiles
UNION ALL SELECT 'applications', count(*) FROM applications
UNION ALL SELECT 'application_status_history', count(*) FROM application_status_history;
