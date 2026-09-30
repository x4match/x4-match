-- Verificación de cuentas de club desde el backoffice.
-- Cuentas existentes quedan APPROVED; los clubes nuevos se registran PENDING.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_verification_status') THEN
    CREATE TYPE account_verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_status account_verification_status
    NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_users_verification_pending
  ON users (created_at DESC)
  WHERE verification_status = 'PENDING';
