-- Disponibilidad semanal del jugador y solicitudes de partido (anotarse solo)
CREATE TABLE IF NOT EXISTS player_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour INT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INT NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_hour < end_hour)
);

CREATE INDEX IF NOT EXISTS idx_player_availability_user
  ON player_availability (user_id, day_of_week);

CREATE TABLE IF NOT EXISTS match_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  match_date DATE NOT NULL,
  start_hour INT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INT NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  level_min NUMERIC(3,1),
  level_max NUMERIC(3,1),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_hour < end_hour)
);

CREATE INDEX IF NOT EXISTS idx_match_requests_user
  ON match_requests (user_id, created_at DESC);
