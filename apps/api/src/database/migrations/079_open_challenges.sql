-- Desafíos abiertos: cualquier jugador puede desafiar a otro (1v1 o 2v2),
-- sin requisito de ranking ni de clubes distintos.
ALTER TABLE club_challenges
  ALTER COLUMN challenger_club_id DROP NOT NULL,
  ALTER COLUMN challenged_club_id DROP NOT NULL,
  ALTER COLUMN challenger_partner_user_id DROP NOT NULL;

ALTER TABLE club_challenges
  DROP CONSTRAINT IF EXISTS club_challenges_check;
