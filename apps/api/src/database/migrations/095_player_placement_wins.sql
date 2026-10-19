-- Nivelación: victorias para resolver la categoría final (confirma, baja 1 o baja 2)

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS placement_wins INT NOT NULL DEFAULT 0;
