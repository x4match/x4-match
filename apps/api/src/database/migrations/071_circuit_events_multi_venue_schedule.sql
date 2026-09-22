-- Circuit events (WPE-style multi-day / multi-venue stages) + match venue scheduling

CREATE TABLE IF NOT EXISTS circuit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  primary_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  schedule_status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (schedule_status IN ('DRAFT', 'PUBLISHED')),
  match_duration_minutes INT NOT NULL DEFAULT 90 CHECK (match_duration_minutes BETWEEN 30 AND 180),
  day_start_hour INT NOT NULL DEFAULT 9 CHECK (day_start_hour >= 0 AND day_start_hour <= 23),
  day_end_hour INT NOT NULL DEFAULT 22 CHECK (day_end_hour > 0 AND day_end_hour <= 24),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circuit_id, name)
);

CREATE INDEX IF NOT EXISTS idx_circuit_events_circuit
  ON circuit_events (circuit_id, start_date DESC);

CREATE TABLE IF NOT EXISTS circuit_event_venues (
  event_id UUID NOT NULL REFERENCES circuit_events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  courts_count INT NOT NULL DEFAULT 2 CHECK (courts_count >= 1 AND courts_count <= 40),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_circuit_event_venues_club
  ON circuit_event_venues (club_id);

ALTER TABLE circuit_stages
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES circuit_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circuit_stages_event
  ON circuit_stages (event_id);

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_published BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_club_scheduled
  ON tournament_matches (club_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_published
  ON tournament_matches (tournament_id, schedule_published, scheduled_at);

-- Per-registration availability snapshot for an event day range
CREATE TABLE IF NOT EXISTS tournament_registration_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INT NOT NULL CHECK (end_hour > start_hour AND end_hour <= 24),
  preferred_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, day_date, start_hour, end_hour, preferred_club_id)
);

CREATE INDEX IF NOT EXISTS idx_reg_availability_registration
  ON tournament_registration_availability (registration_id, day_date);
