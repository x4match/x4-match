-- Identidad institucional del circuito + staff con roles (Presidente, Admin, Fiscal, Staff)

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- La sigla identifica al circuito en los carteles de perfil (rol + sigla, ej. "Presidente CAS"):
-- no puede repetirse entre circuitos vigentes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_circuits_short_name_active
  ON circuits (UPPER(short_name))
  WHERE short_name IS NOT NULL AND status <> 'CANCELLED';

CREATE TABLE IF NOT EXISTS circuit_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('PRESIDENT', 'ADMIN', 'REFEREE', 'STAFF')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'DECLINED', 'REVOKED', 'LEFT')),
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circuit_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_circuit_staff_one_president
  ON circuit_staff (circuit_id)
  WHERE role = 'PRESIDENT' AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_circuit_staff_user_status
  ON circuit_staff (user_id, status);

CREATE INDEX IF NOT EXISTS idx_circuit_staff_circuit_status
  ON circuit_staff (circuit_id, status);

INSERT INTO circuit_staff (circuit_id, user_id, role, status, invited_by_user_id, responded_at)
SELECT c.id, c.created_by_user_id, 'PRESIDENT', 'ACTIVE', c.created_by_user_id, NOW()
FROM circuits c
WHERE c.created_by_user_id IS NOT NULL
ON CONFLICT (circuit_id, user_id) DO NOTHING;
