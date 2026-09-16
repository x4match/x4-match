CREATE TABLE IF NOT EXISTS club_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_photos_club_id
  ON club_photos (club_id, sort_order ASC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_photos_one_primary
  ON club_photos (club_id)
  WHERE is_primary = TRUE;
