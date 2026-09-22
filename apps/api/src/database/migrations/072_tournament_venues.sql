-- Torneos multi-sede (varias canchas / clubes)
CREATE TABLE IF NOT EXISTS tournament_venues (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_venues_club
  ON tournament_venues (club_id);

-- Backfill sede primaria desde tournaments.club_id
INSERT INTO tournament_venues (tournament_id, club_id, is_primary, sort_order)
SELECT t.id, t.club_id, TRUE, 0
FROM tournaments t
WHERE t.club_id IS NOT NULL
ON CONFLICT (tournament_id, club_id) DO NOTHING;
