# x4 match — Panel Club (web)

Panel web para `CLUB_ADMIN` / `SUPER_ADMIN`. Paridad con el gerente de la app móvil.

## Setup

```bash
# desde la raíz del monorepo
pnpm install
pnpm --filter web-club dev
```

Abre [http://localhost:3001](http://localhost:3001).

Configurá la API en `apps/web-club/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev:web-club` | Dev server (puerto 3001) |
| `pnpm build:web-club` | Build de producción |

## Rutas

- `/` — landing pública (default)
- `/precios` — planes BASIC / GROWTH / PRO
- `/login` — acceso club
- `/panel` — Dashboard gerente (autenticado)
- `/gestion` — canchas, turnos, promos, Smart Fill
- `/facturacion` — movimientos, links MP, cobros
- `/clientes` — segmentos + campañas CRM
- `/alertas` — alertas accionables
- `/tienda` — productos, cupones, ventas
- `/ranking` — ranking y validaciones
- `/perfil` — datos, logo/cover, sedes

## vs Puntoo (features nuevas)

- **Smart Fill**: `PATCH /clubs/:id/auto-fill-gaps` con `hoursBefore`, `autoCreateMatch`, `notifyEnabled` (migration `047_club_gap_fill_rules.sql`)
- **CRM**: `POST /clubs/:id/segments/notify`
- **Cobros**: revenue con `checkoutUrl` / `provider` / cancha
- Migrar DB: `pnpm --filter api db:migrate` (requiere Postgres)

## Diseño

Tokens Night Match / Bright Court de `apps/mobile/DESIGN.md`, Geist + shadcn/ui.
