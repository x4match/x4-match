-- Reservas tomadas por fuera de la app (teléfono, WhatsApp, mostrador) para la planilla del club

ALTER TABLE court_availability_slots
  ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS booked_by_name TEXT,
  ADD COLUMN IF NOT EXISTS booked_by_phone TEXT;

ALTER TABLE court_availability_slots
  DROP CONSTRAINT IF EXISTS court_availability_slots_booking_source_check;

ALTER TABLE court_availability_slots
  ADD CONSTRAINT court_availability_slots_booking_source_check
  CHECK (booking_source IS NULL OR booking_source IN ('APP', 'MANUAL'));

UPDATE court_availability_slots
SET booking_source = 'APP'
WHERE status = 'BOOKED' AND booking_source IS NULL;
