-- Promos/cupones otorgan puntos canjeables (wallet), no ranking competitivo del club.
-- Permite bonus_points = 0 cuando el boost viene solo del multiplicador por plan.

ALTER TABLE club_promotions
  DROP CONSTRAINT IF EXISTS club_promotions_bonus_points_check;

ALTER TABLE club_promotions
  ADD CONSTRAINT club_promotions_bonus_points_check CHECK (bonus_points >= 0);

CREATE TABLE IF NOT EXISTS club_shop_coupon_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES club_shop_coupons(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_awarded INT NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_shop_coupon_claims_user
  ON club_shop_coupon_claims (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_shop_coupon_claims_club
  ON club_shop_coupon_claims (club_id, created_at DESC);
