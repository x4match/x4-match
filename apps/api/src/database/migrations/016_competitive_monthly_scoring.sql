-- Puntaje competitivo mensual (partidos casuales, no torneos)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches (tournament_id)
  WHERE tournament_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS player_competitive_monthly_points (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key CHAR(7) NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  points INT NOT NULL DEFAULT 0,
  matches_played INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_player_competitive_monthly_leaderboard
  ON player_competitive_monthly_points (month_key, points DESC);

CREATE TABLE IF NOT EXISTS player_competitive_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  month_key CHAR(7) NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  points INT NOT NULL,
  base_points INT NOT NULL,
  my_category TEXT NOT NULL,
  opponent_categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_player_competitive_ledger_month
  ON player_competitive_points_ledger (month_key, user_id);
