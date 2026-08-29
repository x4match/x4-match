# Backend MVP SQL-first

## Estructura aplicada

- `src/database`: conexión `pg` + migraciones SQL.
- `src/modules` no existía en el backend previo, por eso se mantuvo estructura actual por dominios (`auth`, `players`, `matches`, etc.) para no romper imports existentes.
- Módulos listos para evolución: `tournaments`, `third-time`, `shop`, `community`, `realtime`.

## Migraciones (SQL + Sequelize, sin Prisma)

```bash
cd apps/api
pnpm db:migrate    # aplica src/database/migrations/*.sql
pnpm db:seed       # datos demo (opcional)
# o en un paso:
pnpm db:setup
```

Archivos: `001_init_mvp.sql` … `005_circuits.sql` (ver carpeta `migrations/`).

## Endpoints MVP implementados

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Players
- `GET /players/me`
- `PATCH /players/me`
- `GET /players`
- `GET /players/:id`

### Matches
- `POST /matches`
- `GET /matches`
- `GET /matches/me`
- `GET /matches/:id`
- `POST /matches/:id/join`
- `POST /matches/:id/leave`
- `PATCH /matches/:id/status`
- `POST /matches/:id/result`

### Chat de match
- `GET /matches/:id/messages`
- `POST /matches/:id/messages`

### Community
- `GET /community/feed`
- `GET /community/players-nearby`

### Clubs
- `GET /clubs`
- `GET /clubs/:id`

### Tournaments (estructura preparada)
- `POST /tournaments`
- `GET /tournaments`
- `GET /tournaments/:id`
- `POST /tournaments/:id/register`
- `GET /tournaments/:id/registrations`
- `POST /tournaments/:id/generate-fixture`
- `GET /tournaments/:id/fixture`
- `GET /tournaments/:id/standings`

### Fotos de torneos (organizadores)
- `GET /tournaments/:id/photos`
- `POST /tournaments/:id/photos` (requiere JWT y rol `CLUB_ADMIN` o `SUPER_ADMIN`)
- `DELETE /tournaments/:id/photos/:photoId` (requiere JWT y rol `CLUB_ADMIN` o `SUPER_ADMIN`)

## Variables Cloudinary (fotos de torneos)

Agregar en `.env` de `apps/api`:

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

## WebSocket events

Gateway: `src/realtime/realtime.gateway.ts`

- `chat:new_message`
- `match:joined`
- `match:left`
- `match:updated`
- `tournament:updated`
- `match:score_updated`

## Requests de ejemplo

### Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"franco@example.com",
    "password":"password123",
    "name":"Franco"
  }'
```

### Crear partido

```bash
curl -X POST http://localhost:3000/matches \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Partido zona norte",
    "date":"2026-05-06T21:00:00.000Z",
    "zone":"Zona Norte",
    "gender":"open",
    "mode":"friendly",
    "neededPlayers":4
  }'
```

### Enviar mensaje de match

```bash
curl -X POST http://localhost:3000/matches/<MATCH_ID>/messages \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Me queda bien 21:00 hs"}'
```

## Conexión con mobile existente

- Base URL actual mobile: `EXPO_PUBLIC_API_URL` (ya usada por `apps/mobile/lib/api.ts`).
- El `AuthContext` actual funciona con `access_token` + `user` (respuesta compatible).
- Siguiente paso recomendado: migrar pantallas de `matchmaking` a endpoints nuevos de `matches` (`create`, `join`, `leave`) manteniendo navegación y estilos actuales.
