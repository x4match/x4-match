-- Opt-in: relleno automático de horarios valle + anti-spam de notificaciones

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS auto_fill_gaps_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS club_gap_fill_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES court_availability_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_gap_fill_notifications_club_user_day
  ON club_gap_fill_notifications (club_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clubs_auto_fill_gaps
  ON clubs (id) WHERE auto_fill_gaps_enabled = TRUE;
