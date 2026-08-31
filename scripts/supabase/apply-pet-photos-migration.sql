-- Idempotent #273 pet_photos gallery (apply on Supabase Cloud when table is missing).
-- Run via Management API: docs/product/FIRST-PARTNER-ONBOARDING.md § Steps

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_sex_check;
ALTER TABLE pets ADD CONSTRAINT pets_sex_check CHECK (
  sex IS NULL OR sex IN (
    'male',
    'female',
    'neutered_male',
    'neutered_female'
  )
);

CREATE TABLE IF NOT EXISTS pet_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0
    CHECK (sort_order >= 0 AND sort_order < 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pet_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_id ON pet_photos(pet_id);

INSERT INTO pet_photos (pet_id, url, sort_order)
SELECT id, photo_url, 0
FROM pets
WHERE photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pet_photos pp WHERE pp.pet_id = pets.id AND pp.sort_order = 0
  );

ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view pet photos for available pets" ON pet_photos;
CREATE POLICY "Public view pet photos for available pets" ON pet_photos
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_photos.pet_id AND p.status = 'available'
    )
  );

DROP POLICY IF EXISTS "Authenticated view pet photos" ON pet_photos;
CREATE POLICY "Authenticated view pet photos" ON pet_photos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Shelter staff manage pet photos" ON pet_photos;
CREATE POLICY "Shelter staff manage pet photos" ON pet_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_photos.pet_id AND is_shelter_staff(p.shelter_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = pet_photos.pet_id AND is_shelter_staff(p.shelter_id)
    )
  );
