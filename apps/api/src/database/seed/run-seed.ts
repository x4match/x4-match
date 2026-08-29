/**
 * Datos de prueba para el esquema MVP (migraciones SQL en src/database/migrations).
 * Ejecutar después de: pnpm db:migrate
 */
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const DEMO_PASSWORD = 'password123';

const CLUBS = [
  {
    id: 'a0000001-0001-4001-8001-000000000001',
    name: 'Pádel Center Palermo',
    city: 'CABA',
    zone: 'Palermo',
    address: 'Av. Libertador 4100',
    phone: '+54 11 4000-0001',
    latitude: -34.5755,
    longitude: -58.4238,
  },
  {
    id: 'a0000001-0001-4001-8001-000000000002',
    name: 'Club Deportivo Norte',
    city: 'Vicente López',
    zone: 'Zona Norte',
    address: 'Av. del Libertador 6000',
    phone: '+54 11 4000-0002',
    latitude: -34.526,
    longitude: -58.473,
  },
] as const;

const USERS = [
  {
    id: 'b0000001-0001-4001-8001-000000000001',
    email: 'juan@example.com',
    name: 'Juan Pérez',
    role: 'PLAYER',
    nickname: 'JuanP',
    city: 'CABA',
    zone: 'Palermo',
    level: 3.5,
  },
  {
    id: 'b0000001-0001-4001-8001-000000000002',
    email: 'maria@example.com',
    name: 'María García',
    role: 'PLAYER',
    nickname: 'MariaG',
    city: 'CABA',
    zone: 'Palermo',
    level: 3.0,
  },
  {
    id: 'b0000001-0001-4001-8001-000000000003',
    email: 'admin@x4match.com',
    name: 'Admin Club',
    role: 'CLUB_ADMIN',
    nickname: 'AdminClub',
    city: 'CABA',
    zone: 'Palermo',
    level: 4.0,
  },
  {
    id: 'b0000001-0001-4001-8001-000000000004',
    email: 'organizer@x4match.com',
    name: 'Organizador x4 match',
    role: 'ORGANIZER',
    nickname: 'OrgX4Match',
    city: 'CABA',
    zone: 'Palermo',
    level: 4.0,
  },
  {
    id: 'b0000001-0001-4001-8001-000000000005',
    email: 'ops@x4match.com',
    name: 'Ops x4 match',
    role: 'SUPER_ADMIN',
  },
] as const;

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL no está definida.');
  }
  try {
    const url = new URL(raw);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl() });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  try {
    const { rows } = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS ok`,
    );
    if (!rows[0]?.ok) {
      throw new Error('La tabla users no existe. Ejecuta primero: pnpm db:migrate');
    }

    console.log('🌱 Seed MVP (Sequelize / SQL)...');

    for (const club of CLUBS) {
      await pool.query(
        `INSERT INTO clubs (id, name, city, zone, address, phone, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           city = EXCLUDED.city,
           zone = EXCLUDED.zone,
           address = EXCLUDED.address,
           phone = EXCLUDED.phone,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           updated_at = NOW()`,
        [
          club.id,
          club.name,
          club.city,
          club.zone,
          club.address,
          club.phone,
          club.latitude,
          club.longitude,
        ],
      );
    }
    console.log(`✅ ${CLUBS.length} clubes`);

    const SHOP_PRODUCTS = [
      {
        clubId: CLUBS[0].id,
        name: 'Tubo de pelotas pro',
        description: '3 pelotas nuevas para el partido',
        price: 4500,
        kind: 'MATCH_ADDON',
        category: 'BALLS',
      },
      {
        clubId: CLUBS[0].id,
        name: 'Alquiler paleta',
        description: 'Por partido',
        price: 3500,
        kind: 'MATCH_ADDON',
        category: 'RENTAL',
      },
      {
        clubId: CLUBS[0].id,
        name: 'Agua 500ml',
        description: null,
        price: 800,
        kind: 'GENERAL',
        category: 'DRINKS',
      },
      {
        clubId: CLUBS[1].id,
        name: 'Tubo pelotas',
        description: 'Extra para tu partido',
        price: 4200,
        kind: 'MATCH_ADDON',
        category: 'BALLS',
      },
    ] as const;

    for (const p of SHOP_PRODUCTS) {
      await pool.query(
        `INSERT INTO club_shop_products (club_id, name, description, price, kind, category, sort_order)
         SELECT $1, $2, $3, $4, $5::shop_product_kind, $6, 0
         WHERE NOT EXISTS (
           SELECT 1 FROM club_shop_products
           WHERE club_id = $1 AND name = $2
         )`,
        [p.clubId, p.name, p.description, p.price, p.kind, p.category],
      );
    }
    console.log(`✅ productos de tienda demo`);

    for (const user of USERS) {
      const userRow = await pool.query<{ id: string }>(
        `INSERT INTO users (id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5::user_role)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           updated_at = NOW()
         RETURNING id`,
        [user.id, user.email, passwordHash, user.name, user.role],
      );
      const userId = userRow.rows[0]?.id ?? user.id;

      if (user.role === 'SUPER_ADMIN') continue;

      await pool.query(
        `INSERT INTO players (
           user_id, nickname, city, zone, level, position,
           category_status, placement_matches_played
         )
         VALUES ($1, $2, $3, $4, $5, 'ambos', 'confirmed', 5)
         ON CONFLICT (user_id) DO UPDATE SET
           nickname = EXCLUDED.nickname,
           city = EXCLUDED.city,
           zone = EXCLUDED.zone,
           level = EXCLUDED.level,
           category_status = 'confirmed',
           placement_matches_played = GREATEST(players.placement_matches_played, 5),
           updated_at = NOW()`,
        [userId, user.nickname, user.city, user.zone, user.level],
      );
    }
    console.log(`✅ ${USERS.length} usuarios + perfiles player`);

    const clubAdminId = USERS.find((u) => u.role === 'CLUB_ADMIN')?.id;
    if (clubAdminId && CLUBS[0]) {
      // Una sola sede por admin de demo: no asociar a todos los clubs
      await pool.query(
        `INSERT INTO club_admins (club_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [CLUBS[0].id, clubAdminId],
      );
      console.log(`✅ club_admins: ${clubAdminId} → ${CLUBS[0].name}`);
    }

    console.log(`   Contraseña demo: ${DEMO_PASSWORD}`);
    console.log('   Emails: juan@example.com, maria@example.com, admin@x4match.com, organizer@x4match.com');
    console.log(`   Backoffice (SUPER_ADMIN): ops@x4match.com / ${DEMO_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
