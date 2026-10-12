/**
 * Credenciales demo para App Review (Apple): jugador + gerente de club.
 * pnpm --filter api db:seed:app-review
 *
 * APP_REVIEW_PASSWORD (opcional) debe coincidir con lo cargado en App Store Connect.
 * Solo crea lo que falta: las cuentas existentes no se modifican.
 */
import * as bcrypt from 'bcryptjs';
import { ClientBase } from 'pg';
import { assertSchemaReady, createSeedPool } from './seed-utils';

const DEFAULT_REVIEW_PASSWORD = 'ReviewX4-2026';
const CLUB_ID = 'a1111111-0001-4001-8001-000000000001';
const PLAYER_ID = 'b1111111-0001-4001-8001-000000000001';
const CLUB_ADMIN_ID = 'b1111111-0001-4001-8001-000000000002';

export const APP_REVIEW_EMAILS = {
  player: 'apple.review.player@x4match.com',
  club: 'apple.review.club@x4match.com',
} as const;

/** Datos que pide el onboarding: sin ellos la app manda al jugador a /onboarding en vez de Home. */
const PLAYER_PROFILE_EXTRAS = {
  declaredCategory: '6ta',
  gender: 'Masculino',
  birthDate: '1995-05-15',
  preferences: { preferredHand: 'right', courtPosition: 'drive' },
};

/** `password-mismatch`: la cuenta existe pero no entra con la contraseña de las notas de review. */
export type CredentialOutcome = 'created' | 'existing' | 'password-mismatch';

export type AppReviewSeedResult = {
  password: string;
  users: Record<keyof typeof APP_REVIEW_EMAILS, CredentialOutcome>;
};

export function appReviewPassword(): string {
  return process.env.APP_REVIEW_PASSWORD?.trim() || DEFAULT_REVIEW_PASSWORD;
}

async function exists(db: ClientBase, sql: string, params: unknown[]): Promise<boolean> {
  const { rowCount } = await db.query(sql, params);
  return (rowCount ?? 0) > 0;
}

async function ensureUser(
  db: ClientBase,
  input: {
    id: string;
    email: string;
    password: string;
    name: string;
    role: 'PLAYER' | 'CLUB_ADMIN';
    nickname: string;
  },
) {
  const existing = await db.query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE lower(email) = lower($1)`,
    [input.email],
  );

  let userId = existing.rows[0]?.id;
  let outcome: CredentialOutcome = 'created';

  if (userId) {
    const matches = await bcrypt.compare(input.password, existing.rows[0].password_hash);
    outcome = matches ? 'existing' : 'password-mismatch';
  } else {
    if (await exists(db, `SELECT 1 FROM users WHERE id = $1`, [input.id])) {
      throw new Error(`El id ${input.id} ya está en uso por otro usuario; no se crea ${input.email}.`);
    }
    const created = await db.query<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, name, role, verification_status, email_verified_at)
       VALUES ($1, $2, $3, $4, $5::user_role, 'APPROVED', NOW())
       RETURNING id`,
      [input.id, input.email, await bcrypt.hash(input.password, 10), input.name, input.role],
    );
    userId = created.rows[0].id;
  }

  if (await exists(db, `SELECT 1 FROM players WHERE user_id = $1`, [userId])) {
    return { userId, outcome };
  }
  if (await exists(db, `SELECT 1 FROM players WHERE lower(nickname) = lower($1)`, [input.nickname])) {
    throw new Error(`El nickname ${input.nickname} ya está en uso; no se crea el perfil de ${input.email}.`);
  }
  await db.query(
    `INSERT INTO players (
       user_id, nickname, city, rating, extras,
       category_status, placement_matches_played
     )
     VALUES ($1, $2, 'CABA', 0, $3::jsonb, 'provisional', 0)`,
    [userId, input.nickname, JSON.stringify(PLAYER_PROFILE_EXTRAS)],
  );

  return { userId, outcome };
}

export async function seedAppReview(
  db: ClientBase,
  password = appReviewPassword(),
): Promise<AppReviewSeedResult> {
  const player = await ensureUser(db, {
    id: PLAYER_ID,
    email: APP_REVIEW_EMAILS.player,
    password,
    name: 'Review Player',
    role: 'PLAYER',
    nickname: 'ReviewPlayer',
  });

  const clubAdmin = await ensureUser(db, {
    id: CLUB_ADMIN_ID,
    email: APP_REVIEW_EMAILS.club,
    password,
    name: 'Review Club',
    role: 'CLUB_ADMIN',
    nickname: 'ReviewClub',
  });

  // El gerente necesita un club propio con acceso habilitado; si no, el tab Gerente queda bloqueado.
  await db.query(
    `INSERT INTO clubs (id, name, city, address, phone)
     VALUES ($1, 'Club Review x4 match', 'CABA', 'Av. Libertador 4100', '+54 11 4000-0099')
     ON CONFLICT (id) DO NOTHING`,
    [CLUB_ID],
  );
  await db.query(
    `INSERT INTO club_admins (club_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [CLUB_ID, clubAdmin.userId],
  );
  const opsApproved = { done: true, at: new Date().toISOString(), note: 'seed-app-review' };
  await db.query(
    `INSERT INTO club_billing (club_id, status, trial_mode, trial_started_at, checklist)
     VALUES ($1, 'TRIAL', 'MANUAL', NOW(), $2::jsonb)
     ON CONFLICT (club_id) DO NOTHING`,
    [CLUB_ID, JSON.stringify({ contract_signed: opsApproved, ops_approved: opsApproved })],
  );

  return {
    password,
    users: { player: player.outcome, club: clubAdmin.outcome },
  };
}

export function logAppReviewResult(result: AppReviewSeedResult) {
  const labels = { player: 'Player', club: 'Club  ' } as const;
  console.log('App Review — credenciales');
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    const email = APP_REVIEW_EMAILS[key];
    const outcome = result.users[key];
    if (outcome === 'password-mismatch') {
      console.warn(
        `  ${labels[key]}: ${email} ya existe pero NO entra con ${result.password}; ` +
          'no se modificó. Corregí la contraseña o las notas de App Store Connect.',
      );
      continue;
    }
    const state = outcome === 'created' ? 'creada' : 'ya existía';
    console.log(`  ${labels[key]}: ${email} / ${result.password} (${state})`);
  }
}

async function main() {
  const pool = createSeedPool();
  const client = await pool.connect();
  try {
    await assertSchemaReady(client);
    await client.query('BEGIN');
    const result = await seedAppReview(client);
    await client.query('COMMIT');
    logAppReviewResult(result);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
