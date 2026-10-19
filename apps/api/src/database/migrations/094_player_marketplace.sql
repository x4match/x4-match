-- Marketplace entre jugadores: publicaciones de productos usados o nuevos (palas, zapatillas, etc.).
-- La compra se coordina por mensaje directo; la plataforma no procesa el pago.

CREATE TABLE IF NOT EXISTS player_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  category VARCHAR(24) NOT NULL DEFAULT 'OTROS',
  condition VARCHAR(16) NOT NULL DEFAULT 'USED'
    CHECK (condition IN ('NEW', 'LIKE_NEW', 'USED')),
  city TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAUSED', 'SOLD', 'DELETED')),
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_listings_active
  ON player_listings (created_at DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_player_listings_seller
  ON player_listings (seller_user_id, created_at DESC);
