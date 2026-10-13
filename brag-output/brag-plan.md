# Brag Plan: x4 match

## What is this app?
x4 match es la app de pádel competitivo en Argentina: encontrás partidos abiertos cerca tuyo según tu nivel, completás los 4 sin grupos de WhatsApp, cargás resultados verificados y subís en un ranking real (rating Elo).

## The angle
Todo jugador de pádel conoce el drama: sos uno, faltan tres. x4 match se presenta como un tráiler de estreno nocturno ("Night Match"): la frase de la propia web — "Encontrá los 3 jugadores que faltan sin grupos de WhatsApp" — tratada como una promesa épica, y el logo de la pelota que pica sobre su trayectoria como cierre de película.

## Hook (first 2-3 seconds)
Negro total. "SOS UNO." aparece seco en Anton blanco. En el golpe de 1.64s, "FALTAN TRES." entra en volt (#D7FF00) con un impacto. Es el problema universal del pádel dicho como frase de tráiler.

## Key moments (the middle)
- La promesa verbatim de la web: "Encontrá los 3 jugadores que faltan" + "sin grupos de WhatsApp." con un tachado volt sobre "WhatsApp".
- La tarjeta real de "Partidos abiertos" (OpenMatchCard): contador "3/4 Join", barra de progreso al 75 %, toque en "Unirse a Partido" → "4/4", barra al 100 %, botón pasa a "Ver partido".
- "RANKING REAL": resultado 6-4 · 6-3 y el rating contando 1000 → 1012 (rating inicial 1000 y Elo K=24 del README: ganar contra un rival igual suma 12).

## Outro / punchline
La pelota amarilla recorre la trayectoria del logo, pica en la V y vuela al extremo; "X4 MATCH" aparece antes de que llegue. Debajo: "PÁDEL COMPETITIVO, PARTIDOS REALES." y "Gratis para jugadores".

## User flow worth showing
1. Entrada: pantalla "Partidos abiertos" con una tarjeta de partido que busca jugadores (3/4).
2. Acción clave: tap en "Unirse a Partido" → el partido queda completo (4/4).
3. Resultado: se carga el resultado y el rating sube en el ranking (1000 → 1012).

## Tone
- Preset: cinematic
- Creative direction: tráiler de estreno nocturno de pádel ("Night Match")
- Interpretation: frases cortas y declarativas en mayúsculas, escenas full-bleed con tipografía enorme, revelaciones dramáticas sobre negro con luz volt; nada de cortes rápidos, cada línea aterriza antes de la siguiente.

## Format: vertical — 1080x1920
## Duration: 21.5s

## Visual identity (from the project)
- Background: #0B0B0B (web `--black`) / #000000 (app Night Match)
- Accent: #D7FF00 (web `--volt`); logo amarillo #E6FA0A
- Text: #FFFFFF; secundario #858585 (`--concrete`); bone #F1F0EA
- Display font: Anton (web `--font-display`)
- Body font: DM Sans (web `--font-sans`); mono: IBM Plex Mono para meta
- Strongest visual element: el logo X4 MATCH (trayectoria + pelota) de `apps/mobile/assets/x4match.svg`, y la tarjeta "Partidos abiertos" de la app.
- Fotos de marca disponibles: `apps/web/assets/cancha.png` (red con "X4 MATCH"), `apps/web/assets/jugador-hero.png`.

## Share copy (draft)
Sos uno, faltan tres. x4 match encuentra a los 3 jugadores que faltan, sin grupos de WhatsApp. Pádel competitivo, partidos reales.

## Audio direction
- Role: cinematic support
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady, clean; recomendado para cinematic)
- Music treatment: entra desde 0s a volumen de cama (~0.32), sube presencia en el logo y hace fade-out en los últimos ~1.2s.
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`, ~110 BPM. Strong cues objetivo: 8.74s (aparece la app), 13.11s (RANKING REAL), 17.47s (logo). Beat grid para el hook: 0.56 / 1.64.
- Audio-reactive treatment: subtle; el brillo volt detrás de la tarjeta y del logo respira con el RMS/bajos de la música. Sin ecualizadores ni ondas.
- SFX posture: sparse (2-4 golpes grandes), motion-matched.
- Audio-coupled moments: impacto en "FALTAN TRES."; click en el tap de "Unirse a Partido"; golpe/bell al completarse 4/4 o al aparecer el logo; golpe seco cuando la pelota pica en la V.
- Restraint rule: nada de SFX en cada línea de texto; nada de ruido agudo repetido.

## Storyboard

### Scene 1 — Hook — 3.8s (0.0–3.8)
Negro. "SOS UNO." en Anton blanco gigante (0.5s). En ~1.64s "FALTAN TRES." en volt, más grande, slam con leve zoom. Hold hasta 3.8.
Sequential/interaction: yes — dos líneas, una tras otra.
Audio intent: tensión, primer golpe.
Audio-coupled idea: impacto en la entrada de "FALTAN TRES.".
Music: cama cinematic entrando.
Transition mood: dramatic → Scene 2

### Scene 2 — La promesa — 4.9s (3.8–8.7)
"ENCONTRÁ LOS 3 JUGADORES QUE FALTAN" en Anton, 3 renglones. Luego "SIN GRUPOS DE WHATSAPP." en DM Sans; una línea volt tacha "WHATSAPP". Fondo con la foto `cancha.png` muy oscurecida para dar textura de pádel.
Sequential/interaction: yes — titular, luego línea secundaria y el tachado.
Audio intent: promesa, confianza.
Audio-coupled idea: none (dejar respirar la música).
Transition mood: dramatic wipe → Scene 3

### Scene 3 — Partidos abiertos (flujo real) — 4.4s (8.7–13.1)
Teléfono centrado con la UI Night Match: título "Partidos abiertos", subtítulo "1 buscando jugadores". Tarjeta OpenMatchCard: foto de cancha, pill "3/4 Join", nombre de club ficticio "Club Norte Pádel", "CATEGORÍA 5ª – 6ª" en volt, "Jue 20:00 · Cancha 2", barra al 75 %, botón "Unirse a Partido". Un tap simulado en el botón → pill "4/4 Join", barra al 100 %, botón borde volt "Ver partido". Caption arriba: "Unite a partidos cerca tuyo según tu nivel".
Sequential/interaction: yes — tap simulado en "Unirse a Partido" y el contador pasa de 3/4 a 4/4.
Audio intent: el producto en acción.
Audio-coupled idea: click en el tap; acento positivo al completar 4/4.
Transition mood: clean → Scene 4

### Scene 4 — Ranking real — 4.4s (13.1–17.5)
"RANKING REAL" en Anton gigante. Debajo, tarjeta de resultado: "6-4 · 6-3" y "Rating" contando 1000 → 1012 en volt, con "+12". Línea: "Resultados verificados. Historial competitivo."
Sequential/interaction: yes — título, tarjeta y contador.
Audio intent: logro, ascenso.
Audio-coupled idea: counter tick sutil o ninguno.
Transition mood: dramatic → Scene 5

### Scene 5 — Logo — 4.0s (17.5–21.5)
Negro. La trayectoria se dibuja detrás de la pelota amarilla: baja, pica en la V con squash, sube al extremo. "X4 MATCH" aparece antes de que la pelota llegue. Luego "PÁDEL COMPETITIVO, PARTIDOS REALES." y "Gratis para jugadores".
Sequential/interaction: yes — recorrido de la pelota, texto, tagline.
Audio intent: payoff, swell.
Audio-coupled idea: golpe en el pique; bell al completar el logo.
Transition mood: final hold + fade

**Music mood for this video:** cinematic
**Audio summary:** una cama limpia y firme que acompaña desde el primer golpe, con 3-4 impactos en el hook, el tap, el pique y el logo, y fade-out sobre el cierre.

## Data notes
- "Club Norte Pádel", la fecha y la categoría de la tarjeta son datos ficticios de ejemplo (no hay datos reales de usuarios ni clubes en el video).
