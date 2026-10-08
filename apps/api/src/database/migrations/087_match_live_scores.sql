-- Marcador en vivo punto a punto de un partido. `history` guarda los estados previos
-- para poder deshacer; `version` evita que dos dispositivos sumen el mismo punto.
CREATE TABLE IF NOT EXISTS match_live_scores (
  match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'LIVE' CHECK (status IN ('LIVE', 'FINISHED')),
  deuce_mode TEXT NOT NULL DEFAULT 'advantage' CHECK (deuce_mode IN ('advantage', 'golden')),
  super_tiebreak BOOLEAN NOT NULL DEFAULT FALSE,
  state JSONB NOT NULL,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 0,
  started_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_match_live_scores_status
  ON match_live_scores (status) WHERE status = 'LIVE';
