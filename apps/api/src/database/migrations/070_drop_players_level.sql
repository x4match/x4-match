-- Quitar level legacy de players. El skill vive en rating.
-- Idempotente: si level ya no existe (p. ej. drop manual previo), no falla.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'level'
  ) THEN
    UPDATE players
    SET rating = ROUND(1000 + (COALESCE(level, 2.5) - 2.5) * 80)
    WHERE rating IS NULL;

    ALTER TABLE players DROP COLUMN level;
  END IF;
END $$;
