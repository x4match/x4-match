-- Unificar ubicación: location/city/address/venue_note. Eliminar columna zone.

-- Jugadores: preservar zone en extras.location si aún no hay location canónica.
UPDATE players
SET extras = COALESCE(extras, '{}'::jsonb)
  || jsonb_build_object(
       'location',
       COALESCE(
         NULLIF(extras->>'location', ''),
         NULLIF(TRIM(BOTH FROM CONCAT_WS(', ', NULLIF(zone, ''), NULLIF(city, ''))), '')
       )
     )
WHERE zone IS NOT NULL
  AND TRIM(zone) <> ''
  AND (extras->>'location' IS NULL OR extras->>'location' = '');

UPDATE players
SET city = COALESCE(NULLIF(city, ''), NULLIF(zone, ''))
WHERE (city IS NULL OR TRIM(city) = '')
  AND zone IS NOT NULL
  AND TRIM(zone) <> '';

-- Partidos: pasar zone a venue_note si no había detalle externo.
UPDATE matches
SET venue_note = COALESCE(NULLIF(TRIM(venue_note), ''), NULLIF(TRIM(zone), ''))
WHERE zone IS NOT NULL
  AND TRIM(zone) <> ''
  AND (venue_note IS NULL OR TRIM(venue_note) = '');

-- Clubs: si no hay city, usar zone como city.
UPDATE clubs
SET city = COALESCE(NULLIF(TRIM(city), ''), NULLIF(TRIM(zone), ''))
WHERE zone IS NOT NULL
  AND TRIM(zone) <> ''
  AND (city IS NULL OR TRIM(city) = '');

ALTER TABLE players DROP COLUMN IF EXISTS zone;
ALTER TABLE clubs DROP COLUMN IF EXISTS zone;
ALTER TABLE matches DROP COLUMN IF EXISTS zone;
