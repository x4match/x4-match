-- Radio (km) alrededor del club para "Avisar jugadores". Configurable por el club.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS slot_offer_radius_km SMALLINT NOT NULL DEFAULT 10;

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_slot_offer_radius_km_check;
ALTER TABLE clubs
  ADD CONSTRAINT clubs_slot_offer_radius_km_check CHECK (slot_offer_radius_km BETWEEN 1 AND 50);
