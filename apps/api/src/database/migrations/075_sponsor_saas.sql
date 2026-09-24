-- SaaS partners / sponsor e-commerce

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'PARTNER'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'PARTNER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_domain_status') THEN
    CREATE TYPE sponsor_domain_status AS ENUM ('NONE', 'PENDING_DNS', 'ACTIVE', 'FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_member_role') THEN
    CREATE TYPE sponsor_member_role AS ENUM ('OWNER', 'EDITOR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_shipping_type') THEN
    CREATE TYPE sponsor_shipping_type AS ENUM ('PICKUP', 'FLAT', 'FREE_OVER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_payment_method') THEN
    CREATE TYPE sponsor_payment_method AS ENUM ('MERCADOPAGO', 'WHATSAPP');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_payment_status') THEN
    CREATE TYPE sponsor_payment_status AS ENUM ('DISCONNECTED', 'CONNECTED', 'EXPIRED');
  END IF;
END $$;

-- Extend platform_order_status for WhatsApp manual payment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'platform_order_status' AND e.enumlabel = 'AWAITING_MANUAL_PAYMENT'
  ) THEN
    ALTER TYPE platform_order_status ADD VALUE 'AWAITING_MANUAL_PAYMENT';
  END IF;
END $$;

ALTER TABLE platform_sponsors
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#0F766E',
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS home_intro TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS contact_address TEXT,
  ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status sponsor_domain_status NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS custom_domain_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE platform_sponsors
SET slug = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE slug IS NULL OR slug = '';

UPDATE platform_sponsors s
SET slug = slug || '-' || substr(replace(id::text, '-', ''), 1, 6)
WHERE EXISTS (
  SELECT 1 FROM platform_sponsors o
  WHERE o.slug = s.slug AND o.id <> s.id
);

ALTER TABLE platform_sponsors
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_sponsors_slug
  ON platform_sponsors (slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_sponsors_custom_domain
  ON platform_sponsors (custom_domain)
  WHERE custom_domain IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_sponsor_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role sponsor_member_role NOT NULL DEFAULT 'OWNER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sponsor_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_sponsor_members_user
  ON platform_sponsor_members (user_id);

CREATE TABLE IF NOT EXISTS platform_sponsor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sponsor_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_platform_sponsor_categories_sponsor
  ON platform_sponsor_categories (sponsor_id, sort_order);

ALTER TABLE platform_products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES platform_sponsor_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS platform_sponsor_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT,
  discount_percent NUMERIC(5, 2),
  discount_amount NUMERIC(10, 2),
  max_uses INT,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sponsor_id, code)
);

CREATE TABLE IF NOT EXISTS platform_sponsor_shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  type sponsor_shipping_type NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  min_order NUMERIC(10, 2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_sponsor_shipping_sponsor
  ON platform_sponsor_shipping_methods (sponsor_id, sort_order);

CREATE TABLE IF NOT EXISTS platform_sponsor_payment_config (
  sponsor_id UUID PRIMARY KEY REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  mp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mp_user_id TEXT,
  mp_access_token_encrypted TEXT,
  mp_refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  mp_status sponsor_payment_status NOT NULL DEFAULT 'DISCONNECTED',
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_sponsor_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sponsor_id, email)
);

ALTER TABLE platform_orders
  ADD COLUMN IF NOT EXISTS sponsor_id UUID REFERENCES platform_sponsors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES platform_sponsor_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES platform_sponsor_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_method_id UUID REFERENCES platform_sponsor_shipping_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS payment_method sponsor_payment_method;

ALTER TABLE platform_orders
  ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_orders_sponsor
  ON platform_orders (sponsor_id, created_at DESC);

-- Seed slug for demo sponsor
UPDATE platform_sponsors
SET slug = 'x4-partners',
    tagline = 'Productos oficiales x4',
    contact_whatsapp = '5491100000000'
WHERE name = 'x4 Partners' AND (slug IS NULL OR slug = 'x4-partners' OR slug LIKE 'x4-partners%');
