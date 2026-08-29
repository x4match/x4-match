DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'circuit_status') THEN
    CREATE TYPE circuit_status AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS circuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  season TEXT,
  status circuit_status NOT NULL DEFAULT 'DRAFT',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circuit_id, label)
);

CREATE TABLE IF NOT EXISTS circuit_venues (
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (circuit_id, club_id)
);

CREATE TABLE IF NOT EXISTS circuit_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  category_id UUID REFERENCES circuit_categories(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  name TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES circuit_categories(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  tournaments_played INT NOT NULL DEFAULT 0,
  position INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circuit_id, category_id, player_id)
);

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS circuit_id UUID REFERENCES circuits(id) ON DELETE SET NULL;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS circuit_stage_id UUID REFERENCES circuit_stages(id) ON DELETE SET NULL;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS circuit_category_id UUID REFERENCES circuit_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circuit_stages_circuit ON circuit_stages(circuit_id, start_date);
CREATE INDEX IF NOT EXISTS idx_circuit_rankings_circuit ON circuit_rankings(circuit_id, category_id, points DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_circuit ON tournaments(circuit_id);
