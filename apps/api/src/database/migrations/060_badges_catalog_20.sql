-- Amplía el catálogo a 20 insignias (9 nuevas).
INSERT INTO badges (code, name, description, icon, category, sort_order) VALUES
  ('ironman_50', '50 partidos', 'Jugaste 50 partidos con resultado confirmado.', 'fitness', 'matches', 45),
  ('wins_10', '10 victorias', 'Acumulaste 10 victorias confirmadas.', 'trophy-outline', 'matches', 46),
  ('wins_25', '25 victorias', 'Acumulaste 25 victorias confirmadas.', 'ribbon', 'matches', 47),
  ('competitive_25', 'Competidor pro', 'Jugaste 25 partidos en modo competitivo.', 'shield', 'competitive', 95),
  ('club_loyal_25', 'Socio fiel', 'Jugaste 25 partidos en el mismo club.', 'home', 'club', 105),
  ('early_bird', 'Madrugador', 'Ganaste un partido que empezó antes de las 10:00.', 'sunny', 'fun', 112),
  ('weekend_warrior', 'Guerrero de finde', 'Ganaste un partido el sábado o domingo.', 'calendar', 'fun', 115),
  ('clean_sweep', 'Barrida', 'Ganaste un partido 2-0 sin perder sets.', 'flash', 'skill', 85),
  ('social_10', 'Social', 'Jugaste contra 10 rivales distintos.', 'people', 'club', 108)
ON CONFLICT (code) DO NOTHING;
