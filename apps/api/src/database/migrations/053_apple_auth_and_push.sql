ALTER TABLE users
  ADD COLUMN IF NOT EXISTS apple_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_apple_id_unique
  ON users (apple_id)
  WHERE apple_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx
  ON user_push_tokens (user_id);
