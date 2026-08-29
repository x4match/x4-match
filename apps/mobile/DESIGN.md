# x4 match Design System

Fuente de verdad visual para la app móvil x4 match.

## Memorable thing

**"Tu rendimiento de pádel, vivo."** Deportivo, premium, minimalista.

## Estética

- Dual theme: **Night Match** (oscuro negro + amarillo, default) + **Bright Court** (claro, opt-in)
- Superficies estratificadas (surface0–surface3) casi negras con bordes sutiles
- Acentos amarillos para CTAs, links y highlights
- Gradientes suaves en heros y botones primarios
- Glass/blur en navegación flotante y sheets
- Motion spring en interacciones, stagger en listas
- Light no es inversión del dark: superficies rediseñadas sobre papel slate frío

## Color — Night Match (dark, default)

| Token | Valor | Uso |
|-------|-------|-----|
| bg | `#000000` | Fondo app |
| bgElevated | `#0A0A0A` | Elevación / splash accents |
| surface0 | `#111111` | Capas bajas |
| surface1 | `#161616` | Tarjetas |
| surface2 | `#1C1C1C` | Alt / hover |
| surface3 | `#242424` | Controles densos |
| primary | `#F5C518` | Marca, links, tabs activos |
| accent | `#FFE566` | CTAs energéticos (texto dark encima) |
| textPrimary | `#FAFAFA` | Texto principal |
| textSecondary | `#A3A3A3` | Texto secundario |
| textMuted | `#737373` | Meta / captions |

## Color — Bright Court (light)

| Token | Valor | Uso |
|-------|-------|-----|
| bg | `#F1F5F9` | Fondo app (slate-100) |
| bgElevated | `#FFFFFF` | Headers / elevated |
| surface0 | `#E8EEF5` | Capas bajas |
| surface1 | `#FFFFFF` | Tarjetas |
| surface2 | `#F8FAFC` | Alt |
| surface3 | `#E2E8F0` | Controles densos |
| primary | `#0D9488` | Teal-600 — contraste WCAG sobre papel |
| accent | `#84CC16` | Lima-500 — CTAs sólidos (texto `#0B1220`) |
| textPrimary | `#0B1220` | Texto principal |
| textSecondary | `#475569` | Texto secundario |
| textMuted | `#64748B` | Meta / captions |
| border | `rgba(15,23,42,0.08)` | Hairlines |
| glass | `rgba(255,255,255,0.86)` | Tab bar |

### Light strategy

- Primary e accent son **un punto más oscuros** que en dark (contraste sobre blanco).
- Soft tokens (`primarySoft`, etc.) bajan opacidad ~12–16%.
- Sombras más suaves (`shadowOpacity` menor) que en dark.
- Preferencia de usuario: `dark` \| `light` \| `system`. Default de app: **dark**.

## Tipografía

- Familia: **Geist** (400–800)
- Display/H1 para títulos de pantalla
- Label semibold para botones y chips
- Stat tabular para ratings, puntos, posiciones

## Layout

- Padding horizontal estándar: 16px
- Radio tarjetas: 20px (lg)
- Tab bar flotante, máx. 5 destinos + botón central "Jugar"
- Primer viewport tipo poster: hero + acción principal visible sin scroll

## Motion

- Press scale: 0.97 con spring
- FadeInUp stagger: 60ms entre ítems
- Skeleton shimmer: 900ms loop
- AnimatedNumber: 400ms ease-out
- Respetar Reduce Motion

## Componentes

Importar desde `@/components/ui`:

- `Screen`, `AppHeader`, `AppCard`, `PrimaryButton`, `InputField`
- `StatusPill`, `Avatar`, `EmptyState`, `SegmentedControl`
- `PressableScale`, `FadeInUp`, `Skeleton`, `AnimatedNumber`
- `Sheet`, `ToastProvider`, `FloatingTabBar`
- Theme: `ThemeProvider`, `useTheme` (`@/contexts/ThemeContext`)

Componentes de dominio siguen en `@/components/padely` (re-exportan ui + lógica específica).

## Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-03 | Rebrand x4 match + Night Match | Negro minimalista + amarillo como identidad dark |
| 2026-07-13 | Bright Court light extension | `/design-consultation` update — same brand, redesigned light surfaces |
| 2026-07-13 | Default remains dark | Night Match is brand identity; light is opt-in |
| 2026-07-13 | Light primary `#0D9488` | Contrast on white for body/links |
| 2026-07-13 | Cool slate paper `#F1F5F9` | Avoid cream AI-default |
