/**
 * Cuentas demo para App Review (Apple).
 * pnpm --filter api db:seed:app-review
 */
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const REVIEW_PASSWORD = 'ReviewX4-2026';
const CLUB_ID = 'a1111111-0001-4001-8001-000000000001';
const PLAYER_ID = 'b1111111-0001-4001-8001-000000000001';
const CLUB_ADMIN_ID = 'b1111111-0001-4001-8001-000000000002';
const MATCH_ID = 'd1111111-0001-4001-8001-000000000001';

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL no está definida.');
  try {
    const url = new URL(raw);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return raw;
  }
}

async function upsertUser(
  pool: Pool,
  input: {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: 'PLAYER' | 'CLUB_ADMIN';
    nickname: string;
  },
) {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5::user_role)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       updated_at = NOW()`,
    [input.id, input.email, input.passwordHash, input.name, input.role],
  );

  const found = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1)`,
    [input.email],
  );
  const userId = found.rows[0].id;

  await pool.query(
    `INSERT INTO players (
       user_id, nickname, city, zone, rating, extras,
       category_status, placement_matches_played
     )
     VALUES ($1, $2, 'CABA', 'Palermo', 0, '{"declaredCategory":"6ta"}'::jsonb, 'provisional', 0)
     ON CONFLICT (user_id) DO UPDATE SET
       nickname = EXCLUDED.nickname,
       updated_at = NOW()`,
    [userId, input.nickname],
  );

  return userId;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  const passwordHash = await bcrypt.hash(REVIEW_PASSWORD, 10);

  try {
    await pool.query(
      `INSERT INTO clubs (id, name, city, zone, address, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         city = EXCLUDED.city,
         zone = EXCLUDED.zone,
         address = EXCLUDED.address,
         updated_at = NOW()`,
      [
        CLUB_ID,
        'Club Review x4 match',
        'CABA',
        'Palermo',
        'Av. Libertador 4100',
        '+54 11 4000-0099',
      ],
    );

    const playerId = await upsertUser(pool, {
      id: PLAYER_ID,
      email: 'apple.review.player@x4match.com',
      passwordHash,
      name: 'Review Player',
      role: 'PLAYER',
      nickname: 'ReviewPlayer',
    });

    await upsertUser(pool, {
      id: 'b1111111-0001-4001-8001-000000000003',
      email: 'apple.review.delete@x4match.com',
      passwordHash,
      name: 'Review Delete',
      role: 'PLAYER',
      nickname: 'ReviewDelete',
    });

    const clubAdminId = await upsertUser(pool, {
      id: CLUB_ADMIN_ID,
      email: 'apple.review.club@x4match.com',
      passwordHash,
      name: 'Review Club',
      role: 'CLUB_ADMIN',
      nickname: 'ReviewClub',
    });

    await pool.query(
      `INSERT INTO club_admins (club_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [CLUB_ID, clubAdminId],
    );

    const matchDate = new Date();
    matchDate.setDate(matchDate.getDate() + 2);
    matchDate.setHours(19, 0, 0, 0);

    await pool.query(
      `INSERT INTO matches (
         id, club_id, created_by_user_id, title, description, date,
         zone, gender, mode, needed_players, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 'friendly', 4, 'OPEN')
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date,
         status = 'OPEN',
         created_by_user_id = EXCLUDED.created_by_user_id`,
      [
        MATCH_ID,
        CLUB_ID,
        playerId,
        'Partido abierto — App Review',
        'Partido de demostración para App Review.',
        matchDate.toISOString(),
        'Palermo',
      ],
    );

    console.log('App Review users listos en esta DB');
    console.log('Player: apple.review.player@x4match.com /', REVIEW_PASSWORD);
    console.log('Club:   apple.review.club@x4match.com /', REVIEW_PASSWORD);
    console.log('Delete: apple.review.delete@x4match.com /', REVIEW_PASSWORD, '(solo para el video de borrar cuenta)');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
