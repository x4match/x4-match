-- Gestión estilo "Padel Organizer" para circuitos:
-- padrón con categoría por circuito, categorías con nivel/suma, ascensos/descensos,
-- cierre de inscripción, zonas editables, noticias, sponsors y auditoría del staff.

-- Categorías: nivel (1ra = 1 … 8va = 8) o suma mínima de la pareja.
ALTER TABLE circuit_categories
  ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS level SMALLINT,
  ADD COLUMN IF NOT EXISTS sum_total SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'circuit_categories_kind_check') THEN
    ALTER TABLE circuit_categories
      ADD CONSTRAINT circuit_categories_kind_check CHECK (kind IN ('FIXED', 'SUM', 'OPEN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'circuit_categories_level_check') THEN
    ALTER TABLE circuit_categories
      ADD CONSTRAINT circuit_categories_level_check CHECK (level IS NULL OR level BETWEEN 1 AND 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'circuit_categories_sum_check') THEN
    ALTER TABLE circuit_categories
      ADD CONSTRAINT circuit_categories_sum_check CHECK (sum_total IS NULL OR sum_total BETWEEN 2 AND 16);
  END IF;
END $$;

UPDATE circuit_categories
SET kind = 'FIXED',
    level = substring(lower(label) FROM '^\s*([1-8])\s*(ra|da|ta|ma|va|°|º)')::smallint
WHERE kind = 'OPEN'
  AND lower(label) ~ '^\s*[1-8]\s*(ra|da|ta|ma|va|°|º)';

UPDATE circuit_categories
SET kind = 'SUM',
    sum_total = substring(lower(label) FROM 'suma\s*0*([0-9]{1,2})')::smallint
WHERE kind = 'OPEN'
  AND lower(label) ~ 'suma\s*0*([2-9]|1[0-6])\y';

-- Padrón de jugadores del circuito (con o sin cuenta x4match).
CREATE TABLE IF NOT EXISTS circuit_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  gender VARCHAR(12) CHECK (gender IS NULL OR gender IN ('Caballeros', 'Damas')),
  level SMALLINT CHECK (level IS NULL OR level BETWEEN 1 AND 8),
  level_source VARCHAR(12) NOT NULL DEFAULT 'APP'
    CHECK (level_source IN ('APP', 'CIRCUIT', 'REGISTRATION')),
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING', 'INACTIVE')),
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_circuit_players_user
  ON circuit_players (circuit_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circuit_players_circuit
  ON circuit_players (circuit_id, level, full_name);

-- Historial de categoría: alta, correcciones, ascensos y descensos.
CREATE TABLE IF NOT EXISTS circuit_player_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  circuit_player_id UUID NOT NULL REFERENCES circuit_players(id) ON DELETE CASCADE,
  from_level SMALLINT,
  to_level SMALLINT,
  reason VARCHAR(12) NOT NULL
    CHECK (reason IN ('INITIAL', 'CORRECTION', 'PROMOTION', 'RELEGATION')),
  note TEXT,
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuit_player_level_history_player
  ON circuit_player_level_history (circuit_player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circuit_player_level_history_circuit
  ON circuit_player_level_history (circuit_id, created_at DESC);

-- Inscripciones vinculadas al padrón y con motivo de revisión de categoría.
ALTER TABLE tournament_registrations
  ADD COLUMN IF NOT EXISTS circuit_player1_id UUID REFERENCES circuit_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS circuit_player2_id UUID REFERENCES circuit_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_review TEXT;

-- Cierre de inscripción: fecha programada y cierre definitivo manual.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_closed_at TIMESTAMPTZ;

-- Borrador de zonas editable antes de generar los partidos.
CREATE TABLE IF NOT EXISTS tournament_group_entries (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
  group_name VARCHAR(4) NOT NULL,
  slot SMALLINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_group_entries_group
  ON tournament_group_entries (tournament_id, group_name, slot);

-- Noticias del circuito.
CREATE TABLE IF NOT EXISTS circuit_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuit_news_circuit
  ON circuit_news (circuit_id, pinned DESC, published_at DESC);

-- Sponsors del circuito.
CREATE TABLE IF NOT EXISTS circuit_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  tier VARCHAR(10) NOT NULL DEFAULT 'SUPPORT'
    CHECK (tier IN ('MAIN', 'GOLD', 'SILVER', 'SUPPORT')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuit_sponsors_circuit
  ON circuit_sponsors (circuit_id, sort_order);

-- Historial de acciones del staff.
CREATE TABLE IF NOT EXISTS circuit_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(30),
  entity_id UUID,
  summary TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circuit_audit_log_circuit
  ON circuit_audit_log (circuit_id, created_at DESC);
