ALTER TABLE players
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_players_geolocation
  ON players (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
