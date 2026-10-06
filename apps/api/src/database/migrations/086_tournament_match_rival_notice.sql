-- Pareja a la que ya se avisó "tenés rival" en un partido de cuadro (evita avisos repetidos
-- y permite re-avisar si cambia el cruce al corregir un resultado).
ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS rival_notified_key TEXT;
