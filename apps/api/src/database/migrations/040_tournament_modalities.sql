-- Modalidades de torneo (interno / externo), admins por club e invitaciones

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_modality') THEN
    CREATE TYPE tournament_modality AS ENUM ('INTERNAL', 'EXTERNAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_club_validation_status') THEN
    CREATE TYPE tournament_club_validation_status AS ENUM (
      'NOT_REQUIRED',
      'PENDING',
      'APPROVED',
      'REJECTED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_invite_status') THEN
    CREATE TYPE tournament_invite_status AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
  END IF;
END $$;

-- Admins vinculados a un club concreto
CREATE TABLE IF NOT EXISTS club_admins (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_admins_user
  ON club_admins (user_id);

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS modality tournament_modality NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS invite_token TEXT,
  ADD COLUMN IF NOT EXISTS club_validation_status tournament_club_validation_status
    NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS club_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS club_validated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_invite_token
  ON tournaments (invite_token)
  WHERE invite_token IS NOT NULL;

-- Externos existentes con club pasan a APPROVED para no romper listados
UPDATE tournaments
SET club_validation_status = 'APPROVED',
    modality = 'EXTERNAL'
WHERE club_id IS NOT NULL
  AND modality = 'INTERNAL'
  AND club_validation_status = 'NOT_REQUIRED';

CREATE TABLE IF NOT EXISTS tournament_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status tournament_invite_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_invites_user
  ON tournament_invites (tournament_id, invited_user_id)
  WHERE invited_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_invites_tournament
  ON tournament_invites (tournament_id, status);
