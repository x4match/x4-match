CREATE TABLE IF NOT EXISTS tournament_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_photos_tournament_id
  ON tournament_photos (tournament_id, created_at DESC);
