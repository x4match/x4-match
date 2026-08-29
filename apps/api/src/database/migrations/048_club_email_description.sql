-- Contacto público del club (alineado con panel web)
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;
