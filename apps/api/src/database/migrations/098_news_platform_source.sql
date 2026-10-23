-- Noticias oficiales publicadas desde el backoffice (sin club ni moderación).

ALTER TABLE news_posts DROP CONSTRAINT IF EXISTS news_posts_source_check;

ALTER TABLE news_posts
  ADD CONSTRAINT news_posts_source_check CHECK (source IN ('CLUB', 'PLAYER', 'PLATFORM'));
