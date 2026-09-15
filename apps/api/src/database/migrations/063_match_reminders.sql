CREATE TABLE IF NOT EXISTS match_reminders (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('24h', '2h')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_match_reminders_sent_at
  ON match_reminders (sent_at DESC);
