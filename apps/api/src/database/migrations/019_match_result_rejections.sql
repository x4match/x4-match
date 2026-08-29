-- Rechazo explícito de un resultado propuesto (disputa entre parejas)

CREATE TABLE IF NOT EXISTS match_result_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_result_rejections_match ON match_result_rejections (match_id);
