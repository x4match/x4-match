-- Inventario de canchas del club + horarios fijos semanales

CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  has_fixed_schedule BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_courts_club_active
  ON courts (club_id, active, sort_order);

CREATE TABLE IF NOT EXISTS court_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_hour NUMERIC(4, 1) NOT NULL
    CHECK (start_hour >= 0 AND start_hour <= 23.5),
  end_hour NUMERIC(4, 1) NOT NULL
    CHECK (end_hour > start_hour AND end_hour <= 24),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (court_id, day_of_week, start_hour, end_hour)
);

CREATE INDEX IF NOT EXISTS idx_court_schedules_court_day
  ON court_schedules (court_id, day_of_week)
  WHERE active = TRUE;

ALTER TABLE court_availability_slots
  ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES courts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_court_slots_court_id
  ON court_availability_slots (court_id)
  WHERE court_id IS NOT NULL;

-- Backfill: una cancha por cada label distinto ya usado en turnos
INSERT INTO courts (club_id, name, active, sort_order)
SELECT DISTINCT ON (s.club_id, TRIM(s.court_label))
  s.club_id,
  TRIM(s.court_label) AS name,
  TRUE,
  0
FROM court_availability_slots s
WHERE TRIM(s.court_label) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM courts c
    WHERE c.club_id = s.club_id AND c.name = TRIM(s.court_label)
  )
ORDER BY s.club_id, TRIM(s.court_label), s.created_at ASC;

UPDATE court_availability_slots s
SET court_id = c.id
FROM courts c
WHERE s.court_id IS NULL
  AND c.club_id = s.club_id
  AND c.name = TRIM(s.court_label);
