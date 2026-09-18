-- Quitar level legacy de players. El skill vive en rating.
-- Backfill residual por si quedó algún rating NULL.
UPDATE players
SET rating = ROUND(1000 + (COALESCE(level, 2.5) - 2.5) * 80)
WHERE rating IS NULL;

ALTER TABLE players DROP COLUMN IF EXISTS level;
