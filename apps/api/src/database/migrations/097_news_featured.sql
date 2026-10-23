-- El carrusel del home muestra solo las noticias destacadas desde el backoffice.
-- El resto se lista en la pantalla de Novedades.

ALTER TABLE news_posts
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_news_posts_featured_live
  ON news_posts (featured_at DESC)
  WHERE status = 'APPROVED' AND is_featured = TRUE;
