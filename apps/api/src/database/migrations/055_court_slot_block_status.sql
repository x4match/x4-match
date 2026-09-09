-- Bloqueo / mantenimiento de turnos de cancha

ALTER TABLE court_availability_slots
  DROP CONSTRAINT IF EXISTS court_availability_slots_status_check;

ALTER TABLE court_availability_slots
  ADD CONSTRAINT court_availability_slots_status_check
  CHECK (status IN ('OPEN', 'BOOKED', 'CANCELLED', 'BLOCKED', 'MAINTENANCE'));

ALTER TABLE court_availability_slots
  ADD COLUMN IF NOT EXISTS block_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_court_slots_blocked
  ON court_availability_slots (club_id, slot_date)
  WHERE status IN ('BLOCKED', 'MAINTENANCE');
