-- Push diferido: si push_after no es NULL, el push se manda cuando llega esa hora
-- (horario de descanso y agrupado de ofertas de clubes).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS push_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_push_after
  ON notifications (push_after)
  WHERE push_after IS NOT NULL;

-- Registro de avisos de clubes: compartido entre "Avisar jugadores" (manual) y el relleno automático.
ALTER TABLE club_gap_fill_notifications
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL;

ALTER TABLE club_gap_fill_notifications DROP CONSTRAINT IF EXISTS club_gap_fill_notifications_source_check;
ALTER TABLE club_gap_fill_notifications
  ADD CONSTRAINT club_gap_fill_notifications_source_check CHECK (source IN ('auto', 'manual'));

CREATE INDEX IF NOT EXISTS idx_club_gap_fill_notifications_club_created
  ON club_gap_fill_notifications (club_id, created_at DESC);
