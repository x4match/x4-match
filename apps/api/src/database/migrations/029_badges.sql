-- Insignias (catálogo + logros por jugador)

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(64) NOT NULL DEFAULT 'ribbon',
  category VARCHAR(32) NOT NULL DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_earned
  ON user_badges (user_id, earned_at DESC);

INSERT INTO badges (code, name, description, icon, category, sort_order) VALUES
  ('debut', 'Debut', 'Completaste tu primer partido con resultado confirmado.', 'football', 'matches', 10),
  ('first_win', 'Primera victoria', 'Ganaste tu primer partido registrado.', 'trophy', 'matches', 20),
  ('ironman_10', '10 partidos', 'Jugaste 10 partidos con resultado confirmado.', 'medal', 'matches', 30),
  ('ironman_25', '25 partidos', 'Jugaste 25 partidos con resultado confirmado.', 'medal-outline', 'matches', 40),
  ('hot_streak_3', 'Racha x3', 'Ganaste 3 partidos seguidos.', 'flame', 'streak', 50),
  ('hot_streak_5', 'Racha x5', 'Ganaste 5 partidos seguidos.', 'flame', 'streak', 60),
  ('hot_streak_10', 'Racha x10', 'Ganaste 10 partidos seguidos.', 'bonfire', 'streak', 70),
  ('comeback', 'Remontada', 'Ganaste un partido tras perder el primer set.', 'trending-up', 'skill', 80),
  ('competitive_5', 'Competidor', 'Jugaste 5 partidos en modo competitivo.', 'shield-checkmark', 'competitive', 90),
  ('club_regular', 'Habitue', 'Jugaste 5 partidos en el mismo club.', 'business', 'club', 100),
  ('night_owl', 'Nocturno', 'Ganaste un partido que empezó después de las 20:00.', 'moon', 'fun', 110)
ON CONFLICT (code) DO NOTHING;
