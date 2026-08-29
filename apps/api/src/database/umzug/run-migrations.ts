import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { Umzug } from 'umzug';
import { PgStorage, ensureMigrationsTable } from './pg-storage';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL no está definida. En local: apps/api/.env. En Vercel: variable de entorno (Build + Runtime).',
    );
  }
  try {
    const url = new URL(raw);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return raw;
  }
}

function buildUmzug(pool: Pool) {
  return new Umzug({
    migrations: {
      glob: ['*.sql', { cwd: MIGRATIONS_DIR }],
      resolve: ({ name, path: filepath, context }) => ({
        name,
        up: async () => {
          const sql = readFileSync(filepath!, 'utf8');
          const client = await context.pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw err;
          } finally {
            client.release();
          }
        },
      }),
    },
    context: () => ({ pool }),
    storage: new PgStorage(pool),
    logger: console,
  });
}

async function main() {
  const cmd = process.argv[2] ?? 'up';
  const pool = new Pool({ connectionString: databaseUrl() });

  try {
    await ensureMigrationsTable(pool);
    const umzug = buildUmzug(pool);

    if (cmd === 'up') {
      const ran = await umzug.up();
      if (ran.length === 0) {
        console.log('No hay migraciones pendientes.');
      }
    } else if (cmd === 'down') {
      await umzug.down();
    } else if (cmd === 'pending') {
      console.log(await umzug.pending());
    } else if (cmd === 'executed') {
      console.log(await umzug.executed());
    } else if (cmd === 'create') {
      const slug = process.argv[3];
      if (!slug) {
        console.error('Uso: pnpm db:migrate:create <nombre_snake>');
        process.exit(1);
      }
      const iso = new Date().toISOString().replace(/\.\d{3}Z$/, '').replace(/\W/g, '');
      if (!existsSync(MIGRATIONS_DIR)) {
        mkdirSync(MIGRATIONS_DIR, { recursive: true });
      }
      const file = path.join(MIGRATIONS_DIR, `${iso}_${slug}.sql`);
      writeFileSync(file, `-- ${slug}\n\n`);
      console.log('Archivo creado:', file);
    } else {
      console.error('Comando desconocido:', cmd, '(usa: up | down | pending | executed | create)');
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
