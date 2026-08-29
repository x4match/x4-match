-- Intervalos de 30 minutos en horarios de cancha (08:00–00:00)

ALTER TABLE court_availability_slots
  DROP CONSTRAINT IF EXISTS court_availability_slots_start_hour_check,
  DROP CONSTRAINT IF EXISTS court_availability_slots_end_hour_check;

ALTER TABLE court_availability_slots
  ALTER COLUMN start_hour TYPE NUMERIC(4, 1) USING start_hour::numeric,
  ALTER COLUMN end_hour TYPE NUMERIC(4, 1) USING end_hour::numeric;

ALTER TABLE court_availability_slots
  ADD CONSTRAINT court_availability_slots_start_hour_check
    CHECK (start_hour >= 0 AND start_hour <= 23.5),
  ADD CONSTRAINT court_availability_slots_end_hour_check
    CHECK (end_hour > start_hour AND end_hour <= 24);
