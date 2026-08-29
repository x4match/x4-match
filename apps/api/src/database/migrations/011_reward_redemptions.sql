CREATE TABLE IF NOT EXISTS club_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES club_reward_catalog(id) ON DELETE CASCADE,
  points_spent INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_reward_redemptions_user
  ON club_reward_redemptions (club_id, user_id, created_at DESC);
