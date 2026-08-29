-- Sin acuerdo en 48h: partido en disputa, sin puntos, reseñas a rivales

ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'DISPUTED';

ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_result_status_check;
ALTER TABLE match_results
  ADD CONSTRAINT match_results_result_status_check
  CHECK (result_status IN ('pending', 'confirmed', 'disputed'));

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rival_review_deadline_at TIMESTAMPTZ;
