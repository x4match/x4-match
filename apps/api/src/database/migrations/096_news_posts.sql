-- Noticias / banners del carrusel del home.
-- Los clubes publican directo; los jugadores quedan PENDING hasta que un SUPER_ADMIN apruebe.
-- La vigencia por defecto vive en platform_settings y se administra desde el backoffice.

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value)
VALUES ('news.default_duration_days', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  source VARCHAR(8) NOT NULL CHECK (source IN ('CLUB', 'PLAYER')),
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  image_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DELETED')),
  duration_days INT NOT NULL DEFAULT 7 CHECK (duration_days BETWEEN 1 AND 365),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source <> 'CLUB' OR club_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_news_posts_live
  ON news_posts (published_at DESC)
  WHERE status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_news_posts_status
  ON news_posts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_posts_author
  ON news_posts (author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_posts_club
  ON news_posts (club_id, created_at DESC)
  WHERE club_id IS NOT NULL;
