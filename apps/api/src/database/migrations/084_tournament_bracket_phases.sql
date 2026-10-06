-- Cuadros robustos: fase del partido (zona / eliminatoria) y origen de cada lugar del cuadro
-- ("GROUP:A:1" = 1° de la Zona A, "BYE" = pase libre). Permite pre-armar el cuadro con
-- placeholders y completarlo solo cuando termina cada zona.

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS team_a_source TEXT,
  ADD COLUMN IF NOT EXISTS team_b_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_phase_check'
  ) THEN
    ALTER TABLE tournament_matches
      ADD CONSTRAINT tournament_matches_phase_check
      CHECK (phase IS NULL OR phase IN ('GROUP', 'KNOCKOUT'));
  END IF;
END $$;

-- Los cuadros generados antes de esta migración ya encadenaban partidos con next_match_id.
UPDATE tournament_matches
SET phase = 'KNOCKOUT'
WHERE phase IS NULL
  AND (next_match_id IS NOT NULL OR bracket_position IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_phase
  ON tournament_matches (tournament_id, phase, group_name);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_next
  ON tournament_matches (next_match_id)
  WHERE next_match_id IS NOT NULL;
