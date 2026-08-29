-- Rol ORGANIZER (torneos/circuitos), distinto de CLUB_ADMIN (club/canchas)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE user_role AS ENUM ('PLAYER', 'CLUB_ADMIN', 'ORGANIZER', 'SUPER_ADMIN');
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'ORGANIZER'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'ORGANIZER';
    END IF;
  END IF;
END $$;
