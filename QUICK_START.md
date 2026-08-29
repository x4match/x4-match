# 🚀 Inicio Rápido

## 1. Instalar dependencias

```bash
pnpm install
```

## 2. Levantar PostgreSQL

```bash
cd infra
docker compose up -d
```

## 3. Configurar API

```bash
cd apps/api
cp .env.example .env
# Editar .env con tus credenciales
```

## 4. Configurar Base de Datos

```bash
cd apps/api
pnpm db:migrate
pnpm db:seed
```

## 5. Iniciar API

```bash
# Desde la raíz
pnpm dev:api

# O desde apps/api
cd apps/api
pnpm dev
```

La API estará en `http://localhost:3000`

## 6. Iniciar Mobile

```bash
# Desde la raíz
pnpm dev:mobile

# O desde apps/mobile
cd apps/mobile
pnpm start
```

## 📱 Usuarios de Prueba

Después del seed:
- `juan@example.com` / `password123`
- `maria@example.com` / `password123`
- `carlos@example.com` / `password123`
- `ana@example.com` / `password123`

## 🔧 Troubleshooting

### Error de conexión a DB
```bash
docker ps  # Verificar que postgres esté corriendo
cd infra && docker compose up -d
```

### Error en Prisma
```bash
cd apps/api
cd apps/api && pnpm db:migrate
pnpm db:migrate
pnpm db:seed
```

### Error en Mobile
Verificar que `EXPO_PUBLIC_API_URL` esté en `.env` de mobile

