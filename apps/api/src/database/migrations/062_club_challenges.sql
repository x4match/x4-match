-- Desafíos interclub 2v2 + contador de wins del club + badges

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS interclub_wins INT NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE club_challenge_status AS ENUM (
    'PENDING_OPPONENT',
    'PENDING_PARTNER',
    'SCHEDULED',
    'COMPLETED',
    'DECLINED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS club_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  challenged_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  challenger_anchor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenger_partner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenged_anchor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenged_partner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  month_key VARCHAR(7) NOT NULL,
  challenger_rank_snapshot INT NOT NULL DEFAULT 1,
  challenged_rank_snapshot INT NOT NULL DEFAULT 1,
  status club_challenge_status NOT NULL DEFAULT 'PENDING_OPPONENT',
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  winner_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  proposed_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (challenger_club_id <> challenged_club_id)
);

CREATE INDEX IF NOT EXISTS idx_club_challenges_challenger_club
  ON club_challenges (challenger_club_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_challenges_challenged_club
  ON club_challenges (challenged_club_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_challenges_users
  ON club_challenges (challenger_anchor_user_id, challenged_anchor_user_id);

CREATE INDEX IF NOT EXISTS idx_club_challenges_match
  ON club_challenges (match_id)
  WHERE match_id IS NOT NULL;

INSERT INTO badges (code, name, description, icon, category, sort_order) VALUES
  ('interclub_champion', 'Campeón interclub', 'Ganaste un desafío 2v2 entre clubes.', 'trophy', 'competitive', 200),
  ('interclub_challenger', 'Desafiante', 'Participaste en un desafío interclub 2v2.', 'flash', 'competitive', 210)
ON CONFLICT (code) DO NOTHING;
