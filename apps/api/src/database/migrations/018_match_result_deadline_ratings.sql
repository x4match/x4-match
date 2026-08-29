-- Plazo de 48h para confirmar resultado y valoraciones opcionales entre jugadores

ALTER TABLE match_results
  ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirm_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_finalized BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS match_player_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, rater_user_id, rated_user_id),
  CHECK (rater_user_id <> rated_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_player_ratings_match ON match_player_ratings (match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_pending_deadline
  ON match_results (confirm_deadline_at)
  WHERE result_status = 'pending';
