-- Reactiva deposit_percent: % del valor del turno que cada jugador paga para confirmar/reservar.
-- Antes se ignoraba y se cobraba siempre el 100%. Migramos clubs existentes a 100% para no
-- cambiar el cobro de golpe; el club puede bajarlo a seña (p. ej. 25/50).

UPDATE clubs
SET deposit_percent = 100
WHERE deposit_percent IS DISTINCT FROM 100
  AND deposit_percent = 25; -- default histórico no usado en runtime

ALTER TABLE clubs
  ALTER COLUMN deposit_percent SET DEFAULT 100;
