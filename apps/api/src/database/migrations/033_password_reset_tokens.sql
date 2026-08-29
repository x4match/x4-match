-- Tokens / códigos de recuperación de contraseña

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
  ON password_reset_tokens (user_id, expires_at)
  WHERE used_at IS NULL;
