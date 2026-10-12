/**
 * Seed inicial para un entorno nuevo (incluido producción): operador del backoffice
 * (SUPER_ADMIN) + cuentas de App Review. Solo crea lo que no existe: los registros
 * previos (usuarios, contraseñas, club, turnos) quedan intactos. Se puede re-ejecutar.
 *
 * Local:  pnpm --filter api db:seed:initial            (lee apps/api/.env)
 * Server: pnpm --filter api db:seed:initial:ci         (usa las variables del entorno)
 *
 * Variables:
 *   SEED_ADMIN_EMAIL       obligatoria
 *   SEED_ADMIN_PASSWORD    obligatoria, mínimo 12 caracteres (solo se usa al crear)
 *   SEED_ADMIN_NAME        opcional (default "Ops x4 match")
 *   APP_REVIEW_PASSWORD    opcional, debe coincidir con App Store Connect
 *   SEED_SKIP_APP_REVIEW   "true" para no crear las cuentas de review
 */
import * as bcrypt from 'bcryptjs';
import { ClientBase } from 'pg';
import { appReviewPassword, logAppReviewResult, seedAppReview } from './seed-app-review';
import { assertSchemaReady, createSeedPool } from './seed-utils';

const MIN_ADMIN_PASSWORD_LENGTH = 12;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} no está definida.`);
  return value;
}

async function ensureSuperAdmin(db: ClientBase, email: string, password: string, name: string) {
  const existing = await db.query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  if (existing.rows[0]) {
    return { created: false, role: existing.rows[0].role };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO users (email, password_hash, name, role, verification_status, email_verified_at)
     VALUES (lower($1), $2, $3, 'SUPER_ADMIN', 'APPROVED', NOW())`,
    [email, passwordHash, name],
  );
  return { created: true, role: 'SUPER_ADMIN' };
}

async function main() {
  const adminEmail = requiredEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD');
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || 'Ops x4 match';
  const skipAppReview = process.env.SEED_SKIP_APP_REVIEW === 'true';

  if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  const pool = createSeedPool();
  const client = await pool.connect();
  try {
    await assertSchemaReady(client);
    await client.query('BEGIN');

    const admin = await ensureSuperAdmin(client, adminEmail, adminPassword, adminName);
    const review = skipAppReview ? null : await seedAppReview(client, appReviewPassword());

    await client.query('COMMIT');

    if (admin.created) {
      console.log(`Backoffice (SUPER_ADMIN) creado: ${adminEmail}`);
    } else if (admin.role === 'SUPER_ADMIN') {
      console.log(`Backoffice: ${adminEmail} ya existía (sin cambios, conserva su contraseña)`);
    } else {
      console.warn(
        `Backoffice: ${adminEmail} ya existe con rol ${admin.role}; no se modificó. ` +
          'Promovelo desde web-admin o usá otro SEED_ADMIN_EMAIL.',
      );
    }
    if (review) logAppReviewResult(review);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
