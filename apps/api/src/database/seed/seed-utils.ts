import { ClientBase, Pool } from 'pg';

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

function isLocalHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'postgres';
  } catch {
    return false;
  }
}

/** Neon/RDS exigen SSL; un Postgres local (docker-compose) no lo soporta. */
export function createSeedPool(): Pool {
  const connectionString = databaseUrl();
  return new Pool({
    connectionString,
    ssl: isLocalHost(connectionString) ? undefined : { rejectUnauthorized: false },
  });
}

export async function assertSchemaReady(db: ClientBase): Promise<void> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'
    ) AS ok`,
  );
  if (!rows[0]?.ok) {
    throw new Error('Faltan migraciones (users.email_verified_at). Ejecutá primero: pnpm db:migrate');
  }
}
