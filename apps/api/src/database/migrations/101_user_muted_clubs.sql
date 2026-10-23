-- Clubes que un jugador silenció: no recibe ofertas ni campañas de ese club.

CREATE TABLE IF NOT EXISTS user_muted_clubs (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_user_muted_clubs_club ON user_muted_clubs (club_id);
