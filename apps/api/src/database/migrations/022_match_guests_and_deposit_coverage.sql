ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS slot_order INT;

WITH ordered AS (
  SELECT
    match_id,
    player_id,
    ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY created_at ASC) AS slot_order
  FROM match_players
  WHERE slot_order IS NULL
)
UPDATE match_players mp
SET slot_order = ordered.slot_order
FROM ordered
WHERE mp.match_id = ordered.match_id
  AND mp.player_id = ordered.player_id
  AND mp.slot_order IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_players_active_slot
  ON match_players (match_id, slot_order)
  WHERE status IN ('JOINED', 'CONFIRMED');

CREATE TABLE IF NOT EXISTS match_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('partner', 'opponent')),
  slot_order INT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sponsor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_guests_slot
  ON match_guests (match_id, slot_order);

ALTER TABLE match_deposits
  ADD COLUMN IF NOT EXISTS covered_guest_slots INT NOT NULL DEFAULT 0;
