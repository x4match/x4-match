-- Nombre de usuario único (case-insensitive) entre jugadores

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_nickname_lower
  ON players (lower(nickname))
  WHERE nickname IS NOT NULL AND nickname <> '';
