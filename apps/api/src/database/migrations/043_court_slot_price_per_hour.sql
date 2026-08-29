-- El club declara precio por hora del turno (no total)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_availability_slots' AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_availability_slots' AND column_name = 'price_per_hour'
  ) THEN
    ALTER TABLE court_availability_slots RENAME COLUMN price TO price_per_hour;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_availability_slots' AND column_name = 'price_per_hour'
  ) THEN
    ALTER TABLE court_availability_slots
      ADD COLUMN price_per_hour NUMERIC(10, 2)
        CHECK (price_per_hour IS NULL OR price_per_hour >= 0);
  END IF;
END $$;

COMMENT ON COLUMN court_availability_slots.price_per_hour IS
  'Precio por hora declarado por el club para este turno. NULL = usar court_price_per_hour del club.';
