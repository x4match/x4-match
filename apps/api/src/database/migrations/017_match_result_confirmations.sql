-- Resultado al mejor de 3 sets con confirmación de todos los jugadores

ALTER TABLE match_results
  ADD COLUMN IF NOT EXISTS sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS result_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (result_status IN ('pending', 'confirmed'));

CREATE TABLE IF NOT EXISTS match_result_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_result_confirmations_match
  ON match_result_confirmations (match_id);
