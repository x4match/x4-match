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
const SLOT_ID_PREFIX = 'e1111111-0001-4001-8001-00000000000';

/** Datos que pide el onboarding: sin ellos la app manda al jugador a /onboarding en vez de Home. */
const PLAYER_PROFILE_EXTRAS = {
  declaredCategory: '6ta',
  gender: 'Masculino',
  birthDate: '1995-05-15',
  preferences: { preferredHand: 'right', courtPosition: 'drive' },
};

function dateOnly(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

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
    `INSERT INTO users (id, email, password_hash, name, role, verification_status, email_verified_at)
     VALUES ($1, $2, $3, $4, $5::user_role, 'APPROVED', NOW())
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       verification_status = 'APPROVED',
       email_verified_at = COALESCE(users.email_verified_at, NOW()),
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
       user_id, nickname, city, rating, extras,
       category_status, placement_matches_played
     )
     VALUES ($1, $2, 'CABA', 0, $3::jsonb, 'provisional', 0)
     ON CONFLICT (user_id) DO UPDATE SET
       nickname = EXCLUDED.nickname,
       extras = COALESCE(players.extras, '{}'::jsonb) || EXCLUDED.extras,
       updated_at = NOW()`,
    [userId, input.nickname, JSON.stringify(PLAYER_PROFILE_EXTRAS)],
  );

  return userId;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  const passwordHash = await bcrypt.hash(REVIEW_PASSWORD, 10);

  try {
    await pool.query(
      `INSERT INTO clubs (id, name, city, address, phone)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         city = EXCLUDED.city,
         address = EXCLUDED.address,
         updated_at = NOW()`,
      [
        CLUB_ID,
        'Club Review x4 match',
        'CABA',
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

    const courtIds: Record<string, string> = {};
    for (const [index, name] of ['Cancha 1', 'Cancha 2'].entries()) {
      const court = await pool.query<{ id: string }>(
        `INSERT INTO courts (club_id, name, active, sort_order)
         VALUES ($1, $2, TRUE, $3)
         ON CONFLICT (club_id, name) DO UPDATE SET active = TRUE, updated_at = NOW()
         RETURNING id`,
        [CLUB_ID, name, index],
      );
      courtIds[name] = court.rows[0].id;
    }

    const slotPlans = [
      { day: 1, court: 'Cancha 1', start: 9, end: 10.5 },
      { day: 1, court: 'Cancha 2', start: 18, end: 19.5 },
      { day: 2, court: 'Cancha 1', start: 20, end: 21.5 },
      { day: 3, court: 'Cancha 2', start: 11, end: 12.5 },
      { day: 4, court: 'Cancha 1', start: 19, end: 20.5 },
    ];
    for (const [index, slot] of slotPlans.entries()) {
      await pool.query(
        `INSERT INTO court_availability_slots
           (id, club_id, court_label, court_id, slot_date, start_hour, end_hour, created_by_user_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
         ON CONFLICT (id) DO UPDATE SET
           court_id = EXCLUDED.court_id,
           slot_date = EXCLUDED.slot_date,
           start_hour = EXCLUDED.start_hour,
           end_hour = EXCLUDED.end_hour,
           status = 'OPEN'`,
        [
          `${SLOT_ID_PREFIX}${index + 1}`,
          CLUB_ID,
          slot.court,
          courtIds[slot.court],
          dateOnly(slot.day),
          slot.start,
          slot.end,
          clubAdminId,
        ],
      );
    }

    const matchDate = new Date();
    matchDate.setDate(matchDate.getDate() + 2);
    matchDate.setHours(19, 0, 0, 0);

    await pool.query(
      `INSERT INTO matches (
         id, club_id, created_by_user_id, title, description, date,
         gender, mode, needed_players, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'open', 'friendly', 4, 'OPEN')
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
