ALTER TABLE club_shop_products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;

CREATE TABLE IF NOT EXISTS club_shop_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  label VARCHAR(120) NOT NULL,
  discount_percent INTEGER,
  discount_amount NUMERIC(10, 2),
  points_cost INTEGER,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, code)
);

CREATE INDEX IF NOT EXISTS idx_club_shop_coupons_club ON club_shop_coupons (club_id);
