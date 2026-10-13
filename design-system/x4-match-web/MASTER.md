# x4 Match Web — Design System

Fuente: [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) + inspiración [TOKOPEDIA Mobile (Figma)](https://www.figma.com/design/cPBwPXW1U3xA1wZb0EN3Ki/TOKOPEDIA-Mobile) + marca Night Match de la app mobile.

## Productos

| App | Rol | Modo |
|-----|-----|------|
| `web-admin` | Backoffice ops (SUPER_ADMIN) | Dark Night Match |
| `web-sponsors` dashboard | Panel partner / tienda | Dark Night Match |
| `web-sponsors` storefront | Tienda pública | Light Marketplace (Tokopedia-like) |

## Direction

- **Style:** Soft UI Evolution + Bento KPI grids (dashboards) + Flat commerce cards (storefront)
- **Variance:** 4 · **Motion:** 3 (subtle 150–250ms) · **Density:** 8 (ops-dense)
- **Stack:** Next.js 16 + Tailwind 4 (+ shadcn en sponsors)

## Brand tokens — Night Match (admin + partner)

| Role | Hex | Token |
|------|-----|-------|
| Background | `#000000` | `--bg` / `--background` |
| Surface | `#161616` | `--surface` / `--card` |
| Surface elevated | `#1C1C1C` | `--surface2` |
| Border | `rgba(255,255,255,0.08)` | `--border` |
| Text | `#FAFAFA` | `--text` / `--foreground` |
| Muted | `#737373` | `--muted` |
| Primary / CTA | `#D7FF00` | `--primary` |
| On primary | `#0A0A0A` | `--on-primary` |
| Accent | `#E8FF66` | `--accent` |
| Success | `#22C55E` | `--success` |
| Warning | `#F59E0B` | `--warning` |
| Danger | `#EF4444` | `--danger` |

## Brand tokens — Marketplace Light (storefront)

| Role | Hex | Notes |
|------|-----|-------|
| Background | `#F5F7F5` | Soft mint-grey like Tokopedia home |
| Card | `#FFFFFF` | Product / section cards |
| Primary commerce | `#03AC0E` | Tokopedia green for price / trust |
| CTA brand | `#D7FF00` on dark chips | x4 Match accent for badges |
| Text | `#0B1220` | High contrast body |
| Muted | `#64748B` | Meta / categories |

## Typography

- **Family:** Plus Jakarta Sans (headings + body) — friendly SaaS / commerce
- **Scale:** 12 / 14 / 16 / 18 / 24 / 32
- **Body line-height:** 1.5 · **Min touch:** 44×44

## Layout patterns (Tokopedia → desktop)

1. **Sticky glass header** — search / brand / cart or mobile menu; `backdrop-filter: blur(12px)`
2. **Sidebar ops** — grouped nav, active lime pill, dense 8–12px gaps
3. **KPI bento** — 2–4 column metric cards; label 12px muted + value 28–32px bold
4. **Commerce product card** — square media, 2-line title, bold price in trust green, hover lift 1.02
5. **Category chips** — horizontal scroll / grid of icon+label tiles
6. **Status chips** — success / warning / danger soft fills (never color-only)

## Effects

- Radius: 12–16px cards, 999px pills
- Shadow: soft only on light storefront (`0 4px 16px rgba(0,0,0,0.06)`); dark = border, no heavy shadow
- Transitions: 150–200ms ease; respect `prefers-reduced-motion`
- Focus: 2–3px ring in primary / lime

## Anti-patterns (skill + brand)

- No purple SaaS defaults · no emoji icons · no placeholder-only labels
- No hero overlay badges on storefront hero
- Don't use spring overshoot on dense tables
- Don't hardcode hex in components — use CSS variables / theme tokens

## Apps mapping

- **web-admin:** Night Match shell, Plus Jakarta, KPI monitor, glass sidebar
- **web-sponsors dashboard:** Commerce OS — TopBar + sidebar groups + DataTable/bento (v0)
- **web-sponsors storefront:** light marketplace + CartSheet + category rail + sponsor `primary_color`
- **web-club:** Night Match default (html `.dark`), Plus Jakarta, grouped sidebar, glow canvas; light via theme toggle

## Shared shell conventions

- Page kickers uppercase 11px primary
- Titles 28–32px extrabold tracking-tight
- Cards `rounded-2xl border border-border bg-card`
- Touch targets min 44px / `min-h-11`
- Sidebar groups: short section labels + active lime pill
