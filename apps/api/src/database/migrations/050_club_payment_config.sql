CREATE TYPE club_payment_status AS ENUM (
  'DISCONNECTED',
  'CONNECTED',
  'EXPIRED',
  'MANUAL_ONLY'
);

CREATE TABLE IF NOT EXISTS club_payment_config (
  club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  mp_user_id TEXT,
  mp_access_token_encrypted TEXT,
  mp_refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  status club_payment_status NOT NULL DEFAULT 'DISCONNECTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_payment_config_status
  ON club_payment_config (status);
