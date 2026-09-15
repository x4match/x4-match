ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS featured_priority INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tournaments_featured
  ON tournaments (featured_priority DESC, start_date ASC)
  WHERE featured_priority > 0;
