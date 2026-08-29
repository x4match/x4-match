-- Puntuación mensual por club + multiplicador de promos según plan

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_subscription_plan') THEN
    CREATE TYPE club_subscription_plan AS ENUM ('BASIC', 'GROWTH', 'PRO');
  END IF;
END $$;

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS subscription_plan club_subscription_plan NOT NULL DEFAULT 'BASIC';

CREATE TABLE IF NOT EXISTS club_member_monthly_points (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key CHAR(7) NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  points INT NOT NULL DEFAULT 0,
  matches_played INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_club_member_monthly_points_leaderboard
  ON club_member_monthly_points (club_id, month_key, points DESC);

ALTER TABLE club_points_ledger
  ADD COLUMN IF NOT EXISTS month_key CHAR(7) CHECK (month_key IS NULL OR month_key ~ '^\d{4}-\d{2}$'),
  ADD COLUMN IF NOT EXISTS base_amount INT,
  ADD COLUMN IF NOT EXISTS multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1;
