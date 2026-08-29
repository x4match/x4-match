# x4 match Ops — Backoffice interno

Panel web para el equipo x4 match (`SUPER_ADMIN`).

## Arranque

```bash
# Desde la raíz del monorepo (usar pnpm, no npm)
cd ../..
pnpm install
pnpm dev:web-admin
```

Abre [http://localhost:3002](http://localhost:3002)

> **No uses `npm i` dentro de `apps/web-admin`.** Este proyecto es un workspace pnpm.

## Variables

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Login

Solo usuarios con rol `SUPER_ADMIN` en la API.

### Usuario demo (después de `pnpm db:seed`)

| Campo | Valor |
|-------|-------|
| Email | `ops@x4match.com` |
| Contraseña | `password123` |

Si ya tenés la DB sin ese usuario:

```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'ops@x4match.com';
-- o cualquier email existente, luego re-ejecutá seed:
-- cd apps/api && pnpm db:seed
```

### Crear más operadores

Desde el backoffice: **Usuarios → Crear operador SUPER_ADMIN**, o promover un usuario existente con **Hacer ops**.

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/monitor` | KPIs globales, clubes y usuarios recientes |
| `/trials` | Trials + checklist de activación |
| `/clubs` | Listado de clubes |
| `/clubs/[id]` | Detalle, checklist, iniciar trial TIME/MANUAL |
| `/users` | Usuarios de la plataforma |
| `/matches` | Partidos recientes |
| `/tournaments` | Torneos |
| `/payments` | Señas / movimientos MP |
| `/activity` | Actividad reciente |
| `/calendar` | Trials por vencer |

## API

Todos los endpoints bajo `/platform/*` requieren JWT + `SUPER_ADMIN`.
