-- Reglas de puntos estilo WPE + ledger de otorgamientos + gender en rankings

CREATE TABLE IF NOT EXISTS circuit_point_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  placement VARCHAR(40) NOT NULL,
  points INT NOT NULL CHECK (points >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circuit_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_circuit_point_rules_circuit
  ON circuit_point_rules (circuit_id, sort_order);

CREATE TABLE IF NOT EXISTS circuit_points_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES circuit_categories(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES circuit_stages(id) ON DELETE SET NULL,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  placement VARCHAR(40) NOT NULL,
  points INT NOT NULL CHECK (points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_circuit_points_awards_circuit
  ON circuit_points_awards (circuit_id, category_id);

-- Gender en listados de ranking (denormalizado vía join; asegurar columna en categories ya existe)

ALTER TABLE circuit_stages
  ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN NOT NULL DEFAULT FALSE;
