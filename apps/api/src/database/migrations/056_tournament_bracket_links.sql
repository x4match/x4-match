-- Brackets eliminatorios: enlace al siguiente partido + cupo de avance

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_slot VARCHAR(1)
    CHECK (next_slot IS NULL OR next_slot IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS bracket_position INT;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_next
  ON tournament_matches (next_match_id)
  WHERE next_match_id IS NOT NULL;
