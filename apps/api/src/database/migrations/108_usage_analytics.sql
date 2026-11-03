-- Analítica de uso para Grafana: último acceso por usuario, actividad diaria y eventos de producto.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_platform TEXT,
  ADD COLUMN IF NOT EXISTS last_app_version TEXT;

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at DESC NULLS LAST);

-- Una fila por usuario, día (hora Argentina) y plataforma. Base de DAU/WAU/MAU y retención.
CREATE TABLE IF NOT EXISTS user_activity_daily (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  app_version TEXT,
  requests INT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day, platform)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_daily_day ON user_activity_daily (day);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  name TEXT NOT NULL,
  screen TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  platform TEXT NOT NULL DEFAULT 'unknown',
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events (name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON analytics_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
