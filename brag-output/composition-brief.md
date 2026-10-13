# Hyperframes Composition Brief: x4 match

## Objective
Create a short launch-style brag video for x4 match.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 21.5 seconds

## Source Material
- Project root: `/home/franco/Escritorio/projectos/x4 Match`
- Primary files read: `README.md`, `apps/web/components/Hero.tsx`, `apps/web/components/PlayersSection.tsx`, `apps/web/lib/site.ts`, `apps/web/app/globals.css`, `apps/mobile/components/x4match/OpenMatchCard.tsx`, `apps/mobile/assets/x4match.svg`, `apps/mobile/components/ui/X4MatchLoading.tsx`
- Product name: x4 match
- Tagline / strongest claim: "Pádel competitivo, partidos reales."
- Key UI or visual moment to recreate: la tarjeta de "Partidos abiertos" (OpenMatchCard: pill "3/4 Join", barra de cupos, botón "Unirse a Partido") y el logo con la pelota que pica sobre su trayectoria.
- Copy that must appear verbatim:
  - "Encontrá los 3 jugadores que faltan" / "sin grupos de WhatsApp." (PlayersSection)
  - "Partidos abiertos", "Ranking real" (PlayersSection)
  - "Pádel competitivo, partidos reales." (site.ts)
  - "Unirse a Partido", "Ver partido" (OpenMatchCard)
  - "Gratis para jugadores" (PlayersSection → "Siempre gratis")

## Creative Direction
- Tone preset: cinematic
- Creative direction: tráiler de estreno nocturno de pádel ("Night Match")
- Interpretation: frases cortas en mayúsculas Anton, full-bleed, cada línea aterriza y respira antes de la siguiente; luz volt sobre negro, sin cortes nerviosos.
- Angle: todo jugador de pádel conoce el drama de "sos uno, faltan tres". x4 match lo resuelve; el video trata la promesa de la web como un tráiler épico y cierra con el logo animado.
- Hook: negro → "SOS UNO." → "FALTAN TRES." en volt con impacto (1.64 s).
- Outro / punchline: pelota recorriendo la trayectoria del logo, "X4 MATCH", "PÁDEL COMPETITIVO, PARTIDOS REALES."
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #0B0B0B (web `--black`), #000000 (app)
- Text: #FFFFFF / #F1F0EA (bone)
- Accent: #D7FF00 (web `--volt`); logo #E6FA0A
- Display font: Anton (local @font-face)
- Body font: DM Sans (local @font-face); IBM Plex Mono para meta
- Visual references from the project: `apps/web/assets/cancha.png`, paths de `apps/mobile/assets/x4match.svg`, layout de `OpenMatchCard`.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.8s — "SOS UNO." / "FALTAN TRES."
2. La promesa — 4.9s — "ENCONTRÁ LOS 3 JUGADORES QUE FALTAN" + "sin grupos de WhatsApp." con tachado volt
3. Partidos abiertos — 4.4s — tarjeta real, tap en "Unirse a Partido", 3/4 → 4/4
4. Ranking real — 4.4s — "RANKING REAL", 6-4 · 6-3, rating 1000 → 1012 (+12)
5. Logo — 4.0s — pelota + trayectoria, "X4 MATCH", tagline, "Gratis para jugadores"

## Audio
- Audio role: cinematic support
- Audio arc: cama limpia desde 0 s, presencia plena desde la escena de la app, fade-out en el último ~1.2 s mientras el bell final suena.
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: volumen de cama, fade-out final por `data-automation`.
- Music cue guidance: preset `brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (~110 BPM). Strong cues: 8.74 (app), 13.11 (ranking), 17.47 (logo). Hook: 0.56 / 1.64.
- Audio-reactive treatment: skipped — the extraction helper needs numpy, which is not installed on this machine. The volt glows breathe on the known beat grid instead (deterministic, beat-grid driven).
- Audio-coupled moments:
  - Hook — impacto en "FALTAN TRES."
  - Partidos abiertos — click en el tap, acento suave al completar 4/4
  - Logo — golpe cuando la pelota pica en la V; bell al cerrar el logo
- SFX selection guidance: sparse, warm, low HF risk.
- SFX analysis guidance: `brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: decided in the composition after the animation exists.
- Audio files: `brag-output/composition/assets/`

## Hyperframes Instructions
Built with hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes and hyperframes-cli. All runtime dependencies (GSAP, fonts, images, audio) are local. `npx hyperframes check` is the single gate before render. Creation and rendering stay local.
