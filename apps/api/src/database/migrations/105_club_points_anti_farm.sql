-- Anti-farm de puntos canjeables: idempotencia del ledger por (club, user, reason, match/ref).

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_points_ledger_idempotent
  ON club_points_ledger (club_id, user_id, reason, reference_id)
  WHERE reference_id IS NOT NULL;
