-- Modo de cancha del partido abierto: sin cancha / reserva externa / reserva in-app.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS court_booking TEXT NOT NULL DEFAULT 'none';

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS venue_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_court_booking_check'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT matches_court_booking_check
      CHECK (court_booking IN ('none', 'external', 'in_app'));
  END IF;
END $$;

-- Partidos con turno in-app ya reservado
UPDATE matches
SET court_booking = 'in_app'
WHERE court_slot_id IS NOT NULL
  AND court_booking = 'none';

COMMENT ON COLUMN matches.court_booking IS 'none | external | in_app — cómo se gestiona la cancha del partido';
COMMENT ON COLUMN matches.venue_note IS 'Detalle de reserva externa (club/cancha/dirección fuera de la app)';
