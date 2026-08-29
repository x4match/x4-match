-- Engagement club: horarios muertos, puntos, premios y ranking interno

ALTER TABLE court_availability_slots
  ADD COLUMN IF NOT EXISTS bonus_points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS club_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  day_of_week INT CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  start_hour INT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INT NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  bonus_points INT NOT NULL DEFAULT 15 CHECK (bonus_points > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_hour < end_hour)
);

CREATE INDEX IF NOT EXISTS idx_club_promotions_club
  ON club_promotions (club_id) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS club_reward_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_required INT NOT NULL CHECK (points_required > 0),
  reward_type VARCHAR(30) NOT NULL DEFAULT 'BENEFIT'
    CHECK (reward_type IN ('BENEFIT', 'DISCOUNT', 'FREE_SLOT', 'MERCH')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_member_points (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  matches_at_club INT NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_member_points_leaderboard
  ON club_member_points (club_id, points DESC);

CREATE TABLE IF NOT EXISTS club_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason VARCHAR(50) NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_points_ledger_club
  ON club_points_ledger (club_id, created_at DESC);
