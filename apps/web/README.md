# x4 match — Landing pública

Sitio marketing y legal de x4 match.

## Desarrollo

```bash
# Desde la raíz del monorepo
pnpm install
pnpm dev:web
```

Abre [http://localhost:3000](http://localhost:3000).

## Páginas

| Ruta | Contenido |
|------|-----------|
| `/` | Landing principal |
| `/terminos` | Términos y condiciones — jugadores |
| `/terminos-clubes` | Términos y condiciones — clubes (SaaS) |
| `/privacidad` | Política de privacidad |
| `/cookies` | Política de cookies |
| `/eliminar-cuenta` | Solicitud de eliminación de cuenta (Google Play) |

## Variables

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_CLUB_URL` | URL del panel club (default `http://localhost:3001`) |

## Legal

Los textos en `content/legal.ts` son borradores operativos basados en el plan comercial interno. Validar con abogado antes de producción y completar CUIT/razón social en `content/site.ts`.
