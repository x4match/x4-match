-- Rating persistente por jugador + historial por partido (Elo)

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS rating INT;

UPDATE players
SET rating = ROUND(1000 + (COALESCE(level, 2.5) - 2.5) * 80)
WHERE rating IS NULL;

ALTER TABLE players
  ALTER COLUMN rating SET DEFAULT 1000;

CREATE TABLE IF NOT EXISTS player_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rating_before INT NOT NULL,
  rating_after INT NOT NULL,
  delta INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_players_rating ON players (rating DESC);
CREATE INDEX IF NOT EXISTS idx_player_rating_history_user_match
  ON player_rating_history (user_id, match_id);
