-- Multiplicador de puntos canjeables por promoción (independiente del plan del club).
-- Tope: 3.0. Default: 2.0 para horarios valle existentes.

ALTER TABLE club_promotions
  ADD COLUMN IF NOT EXISTS points_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 2;

ALTER TABLE club_promotions
  DROP CONSTRAINT IF EXISTS club_promotions_points_multiplier_check;

ALTER TABLE club_promotions
  ADD CONSTRAINT club_promotions_points_multiplier_check
  CHECK (points_multiplier >= 1 AND points_multiplier <= 3);
