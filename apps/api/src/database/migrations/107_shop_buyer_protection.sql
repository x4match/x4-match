-- Protección al comprador de Shop x4: plazo de entrega, aviso de pago manual, confirmación de
-- recepción, reclamos con respuesta del partner, reseñas y verificación/suspensión de tiendas.

ALTER TABLE platform_orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_reported_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_note TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

UPDATE platform_orders
SET paid_at = COALESCE(paid_at, updated_at)
WHERE status IN ('PAID', 'FULFILLED') AND paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_orders_delivery_deadline
  ON platform_orders (delivery_deadline_at)
  WHERE fulfilled_at IS NULL AND received_at IS NULL;

ALTER TABLE platform_sponsors
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS delivery_days SMALLINT NOT NULL DEFAULT 10;

ALTER TABLE platform_sponsors DROP CONSTRAINT IF EXISTS platform_sponsors_delivery_days_check;
ALTER TABLE platform_sponsors
  ADD CONSTRAINT platform_sponsors_delivery_days_check CHECK (delivery_days BETWEEN 1 AND 60);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_claim_status') THEN
    CREATE TYPE shop_claim_status AS ENUM (
      'OPEN', 'PARTNER_RESPONDED', 'RESOLVED_BUYER', 'RESOLVED_PARTNER', 'WITHDRAWN'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_claim_reason') THEN
    CREATE TYPE shop_claim_reason AS ENUM (
      'NOT_RECEIVED', 'LATE_DELIVERY', 'NOT_AS_DESCRIBED', 'PAYMENT_NOT_ACKNOWLEDGED',
      'NO_RESPONSE', 'SUSPECTED_SCAM', 'OTHER'
    );
  END IF;
END $$;

-- order_id es NULL para reportes de tiendas con catálogo externo (se compra fuera de x4).
CREATE TABLE IF NOT EXISTS platform_shop_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES platform_orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  buyer_email TEXT,
  reason shop_claim_reason NOT NULL,
  description TEXT NOT NULL,
  status shop_claim_status NOT NULL DEFAULT 'OPEN',
  auto_created BOOLEAN NOT NULL DEFAULT FALSE,
  partner_response TEXT,
  partner_responded_at TIMESTAMPTZ,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_shop_claims_sponsor
  ON platform_shop_claims (sponsor_id, status, created_at DESC);

-- Un solo reclamo abierto por pedido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_shop_claims_open_order
  ON platform_shop_claims (order_id)
  WHERE order_id IS NOT NULL AND status IN ('OPEN', 'PARTNER_RESPONDED');

CREATE TABLE IF NOT EXISTS platform_sponsor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES platform_sponsors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE CASCADE,
  author_name TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_sponsor_reviews_sponsor
  ON platform_sponsor_reviews (sponsor_id, created_at DESC);
