-- Ventana de juego del partido (ej. mañana 9–13, noche 18–24)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

COMMENT ON COLUMN matches.ends_at IS 'Fin de la franja horaria del partido (mañana/tarde/noche). Si es NULL, se usa duración por defecto del club.';
