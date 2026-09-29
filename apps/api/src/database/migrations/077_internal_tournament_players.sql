-- Torneo interno: jugadores separados por lado (drive / revés) para armar parejas.
-- Cada pareja formada es una inscripción APPROVED (player1 = drive, player2 = revés).
CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('DRIVE', 'REVES')),
  registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament
  ON tournament_players (tournament_id, side);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_players_user
  ON tournament_players (tournament_id, user_id)
  WHERE user_id IS NOT NULL;
