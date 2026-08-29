-- Unificar stock: flag para ofrecer producto como extra en partidos
ALTER TABLE club_shop_products
  ADD COLUMN IF NOT EXISTS available_as_match_extra BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE club_shop_products
SET available_as_match_extra = TRUE
WHERE kind = 'MATCH_ADDON';

CREATE INDEX IF NOT EXISTS idx_club_shop_products_match_extra
  ON club_shop_products (club_id, available_as_match_extra)
  WHERE active = TRUE AND available_as_match_extra = TRUE;
