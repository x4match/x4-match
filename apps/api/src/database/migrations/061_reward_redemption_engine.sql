-- Motor de canje: stock, cupo, estados y código de retiro

ALTER TABLE club_reward_catalog
  ADD COLUMN IF NOT EXISTS stock INT NULL CHECK (stock IS NULL OR stock >= 0),
  ADD COLUMN IF NOT EXISTS max_per_user INT NULL CHECK (max_per_user IS NULL OR max_per_user >= 1);

DO $$ BEGIN
  CREATE TYPE club_reward_redemption_status AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE club_reward_redemptions
  ADD COLUMN IF NOT EXISTS status club_reward_redemption_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS redemption_code VARCHAR(12),
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Backfill códigos para canjes existentes
UPDATE club_reward_redemptions
SET redemption_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE redemption_code IS NULL;

ALTER TABLE club_reward_redemptions
  ALTER COLUMN redemption_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_club_reward_redemptions_code
  ON club_reward_redemptions (redemption_code);

CREATE INDEX IF NOT EXISTS idx_club_reward_redemptions_club_status
  ON club_reward_redemptions (club_id, status, created_at DESC);
