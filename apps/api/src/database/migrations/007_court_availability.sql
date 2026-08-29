-- Horarios libres de canchas publicados por clubs

CREATE TABLE IF NOT EXISTS court_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_label TEXT NOT NULL DEFAULT 'Cancha 1',
  slot_date DATE NOT NULL,
  start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INT NOT NULL CHECK (end_hour > start_hour AND end_hour <= 24),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'BOOKED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_slots_club_date
  ON court_availability_slots (club_id, slot_date DESC);

CREATE INDEX IF NOT EXISTS idx_court_slots_open
  ON court_availability_slots (status, slot_date)
  WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id) WHERE read = FALSE;
