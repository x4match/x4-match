# Playtomic Clone - Monorepo

Aplicación estilo Playtomic con ranking semanal, matchmaking, chat y sistema de incentivos.

## 🏗️ Estructura del Proyecto

```
playtomic-clone/
├── apps/
│   ├── api/          # Backend NestJS
│   └── mobile/       # App Expo React Native
├── infra/            # Docker compose
└── packages/         # Shared packages (opcional)
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js >= 18
- pnpm >= 8
- Docker y Docker Compose

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Levantar PostgreSQL

```bash
cd infra
docker compose up -d
```

### 3. Configurar variables de entorno

```bash
cd apps/api
cp .env.example .env
```

Editar `.env` con:
```
DATABASE_URL="postgresql://user:password@localhost:5432/playtomic_db?schema=public"
JWT_SECRET="tu-secret-key-aqui"
JWT_EXPIRES_IN="7d"
PORT=3000
```

### 4. Configurar base de datos

```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

### 5. Iniciar API

```bash
# Desde la raíz
pnpm dev:api

# O desde apps/api
cd apps/api
pnpm dev
```

La API estará disponible en `http://localhost:3000`

### 6. Iniciar Mobile

```bash
# Desde la raíz
pnpm dev:mobile

# O desde apps/mobile
cd apps/mobile
pnpm start
```

## 📱 Mobile Setup

1. Instalar dependencias:
```bash
cd apps/mobile
pnpm install
```

2. Configurar `.env`:
```bash
cp .env.example .env
```

Editar con:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

3. Iniciar:
```bash
pnpm start
```

## 📚 API Endpoints

### Autenticación

- `POST /auth/register` - Registro
- `POST /auth/login` - Login
- `GET /auth/me` - Perfil actual (requiere auth)

**Ejemplo Register:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Juan Pérez",
  "photo": "https://..." // opcional
}
```

**Ejemplo Login:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Clubs

- `GET /clubs` - Listar todos los clubs
- `GET /clubs/:id` - Detalle de un club

### Disponibilidad

- `POST /availability` - Establecer disponibilidad (requiere auth)
- `GET /availability/me` - Mi disponibilidad (requiere auth)

**Ejemplo Set Availability:**
```json
{
  "availabilities": [
    {
      "dayOfWeek": 1,  // 0=domingo, 1=lunes, etc.
      "startHour": 10,
      "endHour": 18
    }
  ]
}
```

### Matchmaking

- `POST /match-requests` - Crear solicitud de partido (requiere auth)
- `POST /match-requests/run/:id` - Ejecutar matchmaking (requiere auth)
- `GET /match-requests/me` - Mis solicitudes (requiere auth)

**Ejemplo Create Match Request:**
```json
{
  "clubId": "club-1",  // opcional
  "date": "2024-01-15T00:00:00Z",
  "startHour": 14,
  "endHour": 16,
  "minRating": 1000,  // opcional
  "maxRating": 1300,  // opcional
  "category": "A"     // opcional
}
```

### Matches

- `GET /matches/me` - Mis partidos (requiere auth)
- `GET /matches/:id` - Detalle de partido (requiere auth)
- `POST /matches/:id/confirm` - Confirmar asistencia (requiere auth)
- `POST /matches/:id/result` - Cargar resultado (requiere auth)

**Ejemplo Submit Result:**
```json
{
  "teamAScore": 6,
  "teamBScore": 4
}
```

### Rankings

- `GET /rankings/weekly?clubId=&category=` - Ranking semanal
- `GET /rankings/monthly?clubId=&category=` - Ranking mensual (Fase 2)
- `GET /rankings/season?seasonId=` - Ranking de temporada (Fase 2)

### Chat

WebSocket en `/ws`

**Eventos:**
- `join_match` - Unirse al chat de un match
- `send_message` - Enviar mensaje
- `new_message` - Recibir nuevo mensaje

**Ejemplo:**
```javascript
socket.emit('join_match', { matchId: 'match-id' });
socket.emit('send_message', { matchId: 'match-id', content: 'Hola!' });
```

### Friends (Fase 2)

- `POST /friends/request/:userId` - Enviar solicitud (requiere auth)
- `POST /friends/accept/:requestId` - Aceptar solicitud (requiere auth)
- `POST /friends/reject/:requestId` - Rechazar solicitud (requiere auth)
- `DELETE /friends/:friendId` - Eliminar amigo (requiere auth)
- `GET /friends` - Lista de amigos (requiere auth)
- `GET /friends/pending` - Solicitudes pendientes (requiere auth)

### Master (Fase 2)

- `GET /master/current` - Temporada actual de Master
- `POST /master/register` - Registrarse para Master (requiere auth)

**Ejemplo Register Master:**
```json
{
  "seasonId": "season-id",
  "partnerId": "user-id"
}
```

### Reports (Fase 2)

- `POST /reports` - Crear reporte (requiere auth)
- `POST /reports/block/:userId` - Bloquear usuario (requiere auth)

**Ejemplo Create Report:**
```json
{
  "reportedUserId": "user-id",
  "matchId": "match-id",  // opcional
  "reason": "Comportamiento inapropiado"
}
```

## 🗄️ Base de Datos

### Acceder a Adminer

Abrir `http://localhost:8080` y usar:
- Sistema: PostgreSQL
- Servidor: postgres
- Usuario: user
- Contraseña: password
- Base de datos: playtomic_db

### Comandos Prisma

```bash
cd apps/api

# Generar cliente
pnpm prisma:generate

# Crear migración
pnpm prisma:migrate

# Ejecutar seed
pnpm prisma:seed

# Abrir Prisma Studio
pnpm prisma:studio
```

## 🧪 Usuarios de Prueba

Después de ejecutar el seed, puedes usar:

- `juan@example.com` / `password123`
- `maria@example.com` / `password123`
- `carlos@example.com` / `password123`
- `ana@example.com` / `password123`

## 📦 Scripts Disponibles

### Desde la raíz:

- `pnpm dev:api` - Iniciar API en modo desarrollo
- `pnpm dev:mobile` - Iniciar mobile
- `pnpm build:api` - Build de API
- `pnpm build:mobile` - Build de mobile
- `pnpm lint` - Lint en todos los proyectos

### Desde apps/api:

- `pnpm dev` - Iniciar en modo watch
- `pnpm start` - Iniciar producción
- `pnpm prisma:migrate` - Ejecutar migraciones
- `pnpm prisma:seed` - Ejecutar seed

## 🏗️ Arquitectura

### Backend (NestJS)

- **Auth**: JWT con bcrypt
- **ORM**: Prisma
- **DB**: PostgreSQL
- **WebSocket**: Socket.io para chat
- **Validación**: class-validator

### Mobile (Expo)

- **Framework**: Expo Router
- **UI**: NativeWind (Tailwind RN)
- **Data**: React Query + Axios
- **Auth**: SecureStore para JWT

## 🎯 Features

### Fase 1 (MVP)

✅ Autenticación (registro/login)  
✅ Gestión de clubs  
✅ Disponibilidad de jugadores  
✅ Matchmaking automático  
✅ Confirmación de partidos  
✅ Carga de resultados con actualización de rating (Elo)  
✅ Ranking semanal por club y categoría  
✅ Chat del partido (WebSocket)  
✅ Incentivos por horarios valle  

### Fase 2

✅ Sistema de amigos  
✅ Chat directo entre amigos  
✅ Rankings mensual y de temporada  
✅ Sistema Master (Top 8 parejas)  
✅ Promociones avanzadas de clubs  
✅ Sistema de reportes y bloqueos  

## 🐛 Troubleshooting

### Error de conexión a DB

Verificar que Docker esté corriendo:
```bash
docker ps
```

Si no está corriendo:
```bash
cd infra
docker compose up -d
```

### Error de migraciones

Asegurarse de que la DB esté corriendo y las variables de entorno estén correctas.

### Error en mobile

Verificar que `EXPO_PUBLIC_API_URL` esté configurado correctamente en `.env`.

## 📝 Notas

- El rating inicial es 1000
- El algoritmo Elo usa K=24
- Los bonus points se aplican automáticamente en horarios valle (10-16) o según promociones del club
- El ranking semanal se actualiza diariamente
- Los chats de match solo son accesibles para participantes

## 🔒 Seguridad

- En producción, cambiar `JWT_SECRET` por un valor seguro
- Configurar CORS con dominios específicos
- Usar HTTPS en producción
- Validar y sanitizar todas las entradas

## 📄 Licencia

MIT

