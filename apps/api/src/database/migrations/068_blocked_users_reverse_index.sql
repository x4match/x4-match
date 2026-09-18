-- Índice para consultas de bloqueo en dirección inversa (blocked → blocker)
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked
  ON blocked_users (blocked_id);
