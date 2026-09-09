-- Shop interno de la app (productos de patrocinadores). Independiente de club_shop_*.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_product_status') THEN
    CREATE TYPE platform_product_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_order_status') THEN
    CREATE TYPE platform_order_status AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS platform_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES platform_sponsors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  photo_url TEXT,
  stock_quantity INT,
  category VARCHAR(40) NOT NULL DEFAULT 'MERCH',
  status platform_product_status NOT NULL DEFAULT 'DRAFT',
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_products_active
  ON platform_products (status, sort_order, name)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS platform_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status platform_order_status NOT NULL DEFAULT 'PENDING',
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  payment_status payment_status,
  payment_provider payment_provider,
  payment_external_reference TEXT,
  payment_checkout_url TEXT,
  shipping_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_orders_user
  ON platform_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES platform_products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_order_items_order
  ON platform_order_items (order_id);

-- Catálogo demo (idempotente por nombre de sponsor)
INSERT INTO platform_sponsors (name, website_url, active)
SELECT 'x4 Partners', 'https://x4match.com', TRUE
WHERE NOT EXISTS (SELECT 1 FROM platform_sponsors WHERE name = 'x4 Partners');

INSERT INTO platform_products (sponsor_id, name, description, price, category, status, sort_order, stock_quantity)
SELECT s.id,
       'Grip overgrip pack x3',
       'Pack de overgrips premium del sponsor. Envío o retiro a coordinar.',
       8990,
       'GEAR',
       'ACTIVE',
       1,
       50
FROM platform_sponsors s
WHERE s.name = 'x4 Partners'
  AND NOT EXISTS (SELECT 1 FROM platform_products WHERE name = 'Grip overgrip pack x3');

INSERT INTO platform_products (sponsor_id, name, description, price, category, status, sort_order, stock_quantity)
SELECT s.id,
       'Remera técnica x4',
       'Remera dry-fit edición comunidad x4 match.',
       24990,
       'MERCH',
       'ACTIVE',
       2,
       30
FROM platform_sponsors s
WHERE s.name = 'x4 Partners'
  AND NOT EXISTS (SELECT 1 FROM platform_products WHERE name = 'Remera técnica x4');
