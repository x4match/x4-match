-- SmartClub-like rules: umbral de horas + auto-publicar partido abierto
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS gap_fill_hours_before INT NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS gap_fill_auto_create_match BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gap_fill_notify_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE clubs
  DROP CONSTRAINT IF EXISTS clubs_gap_fill_hours_before_check;

ALTER TABLE clubs
  ADD CONSTRAINT clubs_gap_fill_hours_before_check
  CHECK (gap_fill_hours_before >= 1 AND gap_fill_hours_before <= 72);
