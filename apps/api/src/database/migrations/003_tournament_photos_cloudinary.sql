ALTER TABLE tournament_photos
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
