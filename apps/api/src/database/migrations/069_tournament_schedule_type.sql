-- Tipo de calendario del torneo (independiente del formato del cuadro).
-- SINGLE_DAY = un día (fecha + hora). MULTI_DAY = torneo largo con varias jornadas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_schedule_type') THEN
    CREATE TYPE tournament_schedule_type AS ENUM ('SINGLE_DAY', 'MULTI_DAY');
  END IF;
END $$;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS schedule_type tournament_schedule_type NOT NULL DEFAULT 'SINGLE_DAY';
