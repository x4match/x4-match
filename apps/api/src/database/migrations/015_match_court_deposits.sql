DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    CREATE TYPE payment_provider AS ENUM ('MERCADOPAGO', 'STRIPE', 'MOCK');
  END IF;
END $$;

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS court_price_per_hour NUMERIC(10, 2) DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS deposit_percent INT DEFAULT 25
    CHECK (deposit_percent >= 0 AND deposit_percent <= 100),
  ADD COLUMN IF NOT EXISTS court_duration_hours NUMERIC(3, 1) DEFAULT 1.5;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS court_slot_id UUID REFERENCES court_availability_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS court_label TEXT;

CREATE TABLE IF NOT EXISTS match_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  provider payment_provider NOT NULL DEFAULT 'MERCADOPAGO',
  external_reference TEXT,
  provider_preference_id TEXT,
  provider_payment_id TEXT,
  status payment_status NOT NULL DEFAULT 'PENDING',
  checkout_url TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_deposits_match_status
  ON match_deposits (match_id, status);

CREATE INDEX IF NOT EXISTS idx_match_deposits_external_ref
  ON match_deposits (external_reference)
  WHERE external_reference IS NOT NULL;
