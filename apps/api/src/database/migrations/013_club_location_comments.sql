-- Ubicación del club y comentarios de jugadores

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

CREATE TABLE IF NOT EXISTS club_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_comments_club_created
  ON club_comments (club_id, created_at DESC);
