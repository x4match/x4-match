-- Un jugador puede pagar el turno completo y reservar la cancha al instante
ALTER TABLE match_deposits
  ADD COLUMN IF NOT EXISTS covers_full_court BOOLEAN NOT NULL DEFAULT FALSE;
