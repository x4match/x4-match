-- Escala visible de nivel 0–1000 (antes 0–100)

ALTER TABLE matches
  ALTER COLUMN level_min TYPE INTEGER USING (
    CASE
      WHEN level_min IS NULL THEN NULL
      WHEN level_min <= 7 THEN ROUND(((level_min - 1) * 1000.0) / 6)::INTEGER
      WHEN level_min <= 100 THEN ROUND(level_min * 10)::INTEGER
      ELSE ROUND(level_min)::INTEGER
    END
  ),
  ALTER COLUMN level_max TYPE INTEGER USING (
    CASE
      WHEN level_max IS NULL THEN NULL
      WHEN level_max <= 7 THEN ROUND(((level_max - 1) * 1000.0) / 6)::INTEGER
      WHEN level_max <= 100 THEN ROUND(level_max * 10)::INTEGER
      ELSE ROUND(level_max)::INTEGER
    END
  );

ALTER TABLE match_requests
  ALTER COLUMN level_min TYPE INTEGER USING (
    CASE
      WHEN level_min IS NULL THEN NULL
      WHEN level_min <= 7 THEN ROUND(((level_min - 1) * 1000.0) / 6)::INTEGER
      WHEN level_min <= 100 THEN ROUND(level_min * 10)::INTEGER
      ELSE ROUND(level_min)::INTEGER
    END
  ),
  ALTER COLUMN level_max TYPE INTEGER USING (
    CASE
      WHEN level_max IS NULL THEN NULL
      WHEN level_max <= 7 THEN ROUND(((level_max - 1) * 1000.0) / 6)::INTEGER
      WHEN level_max <= 100 THEN ROUND(level_max * 10)::INTEGER
      ELSE ROUND(level_max)::INTEGER
    END
  );
