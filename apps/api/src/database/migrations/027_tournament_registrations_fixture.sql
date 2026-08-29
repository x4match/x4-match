-- Torneos: fechas, inscripciones (parejas) con pago opcional y fixture (partidos)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_registration_status') THEN
    CREATE TYPE tournament_registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLIST');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_match_status') THEN
    CREATE TYPE tournament_match_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');
  END IF;
END $$;

-- Campos extra del torneo
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS organizer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS courts_available INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT false;

-- Fechas / jornadas del torneo
CREATE TABLE IF NOT EXISTS tournament_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  play_date TIMESTAMPTZ NOT NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_dates_tournament
  ON tournament_dates (tournament_id, play_date);

-- Inscripciones (parejas)
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player1_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player2_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  player1_email TEXT,
  player2_email TEXT,
  phone TEXT,
  category TEXT,
  status tournament_registration_status NOT NULL DEFAULT 'PENDING',
  seed INT,
  -- Pago (opcional)
  payment_required BOOLEAN NOT NULL DEFAULT false,
  payment_status payment_status,
  payment_provider payment_provider,
  payment_amount NUMERIC(10, 2),
  payment_currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  payment_external_reference TEXT,
  payment_checkout_url TEXT,
  payment_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament
  ON tournament_registrations (tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tournament_registrations_payment_ref
  ON tournament_registrations (payment_external_reference)
  WHERE payment_external_reference IS NOT NULL;

-- Partidos / fixture
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  date_id UUID REFERENCES tournament_dates(id) ON DELETE SET NULL,
  round INT NOT NULL DEFAULT 1,
  round_label TEXT,
  group_name TEXT,
  court_label TEXT,
  team_a_registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
  team_b_registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
  team_a_name TEXT,
  team_b_name TEXT,
  status tournament_match_status NOT NULL DEFAULT 'SCHEDULED',
  score JSONB,
  winner_registration_id UUID REFERENCES tournament_registrations(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament
  ON tournament_matches (tournament_id, round);
