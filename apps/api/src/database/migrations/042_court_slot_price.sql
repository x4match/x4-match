-- Precio del turno (total del horario libre publicado por el club)

ALTER TABLE court_availability_slots
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2)
    CHECK (price IS NULL OR price >= 0);

COMMENT ON COLUMN court_availability_slots.price IS
  'Precio total del turno en la moneda del club. NULL = usar precio base del club.';
