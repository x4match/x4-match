-- Nivelación: categoría provisional hasta completar N partidos competitivos

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS category_status TEXT NOT NULL DEFAULT 'provisional',
  ADD COLUMN IF NOT EXISTS placement_matches_played INT NOT NULL DEFAULT 0;

ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_category_status_check;

ALTER TABLE players
  ADD CONSTRAINT players_category_status_check
  CHECK (category_status IN ('provisional', 'confirmed'));

-- Cuentas existentes: ya están niveladas (no forzar re-nivelación)
UPDATE players
SET category_status = 'confirmed',
    placement_matches_played = 5;

CREATE INDEX IF NOT EXISTS idx_players_category_status
  ON players (category_status);
