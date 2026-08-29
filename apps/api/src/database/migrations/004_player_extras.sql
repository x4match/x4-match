-- Preferencias y campos extra del perfil (JSON) sin alterar el esquema relacional base
ALTER TABLE players ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}';
