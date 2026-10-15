-- El creador del partido abierto decide a quién acepta: los que se suman quedan como solicitud.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS join_approval_required BOOLEAN NOT NULL DEFAULT FALSE;
