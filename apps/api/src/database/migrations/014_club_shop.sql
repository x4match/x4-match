-- Tienda del club: productos y compras (extras de partido + venta general)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_product_kind') THEN
    CREATE TYPE shop_product_kind AS ENUM ('MATCH_ADDON', 'GENERAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_purchase_status') THEN
    CREATE TYPE shop_purchase_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS club_shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  kind shop_product_kind NOT NULL DEFAULT 'GENERAL',
  category VARCHAR(30) NOT NULL DEFAULT 'OTHER'
    CHECK (category IN ('BALLS', 'DRINKS', 'FOOD', 'RENTAL', 'MERCH', 'OTHER')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_shop_products_club
  ON club_shop_products (club_id, active, kind);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES club_shop_products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  status shop_purchase_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_match
  ON shop_purchases (match_id, status) WHERE match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_purchases_club
  ON shop_purchases (club_id, created_at DESC);
