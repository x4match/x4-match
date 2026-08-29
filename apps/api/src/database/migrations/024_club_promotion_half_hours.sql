-- Medias horas en promociones de club (alineado con court_availability_slots)

ALTER TABLE club_promotions
  DROP CONSTRAINT IF EXISTS club_promotions_start_hour_check,
  DROP CONSTRAINT IF EXISTS club_promotions_end_hour_check,
  DROP CONSTRAINT IF EXISTS club_promotions_check;

ALTER TABLE club_promotions
  ALTER COLUMN start_hour TYPE NUMERIC(4, 1) USING start_hour::numeric,
  ALTER COLUMN end_hour TYPE NUMERIC(4, 1) USING end_hour::numeric;

ALTER TABLE club_promotions
  ADD CONSTRAINT club_promotions_start_hour_check
    CHECK (start_hour >= 0 AND start_hour <= 23.5),
  ADD CONSTRAINT club_promotions_end_hour_check
    CHECK (end_hour > start_hour AND end_hour <= 24);
