-- POS de mostrador: canal, método de pago, vendedor; user_id opcional (walk-in)

ALTER TABLE shop_purchases
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE shop_purchases
  ADD COLUMN IF NOT EXISTS sold_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN IF NOT EXISTS sale_group_id UUID,
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_purchases_pos_day
  ON shop_purchases (club_id, created_at DESC)
  WHERE channel = 'POS';

CREATE INDEX IF NOT EXISTS idx_shop_purchases_sale_group
  ON shop_purchases (sale_group_id)
  WHERE sale_group_id IS NOT NULL;
