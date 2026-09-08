-- Permite borrar la cuenta sin borrar partidos que otras personas siguen usando.
ALTER TABLE matches
  ALTER COLUMN created_by_user_id DROP NOT NULL;

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_created_by_user_id_fkey;

ALTER TABLE matches
  ADD CONSTRAINT matches_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
