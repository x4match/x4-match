import type { Pool } from 'pg';
import type { MigrationParams, UmzugStorage } from 'umzug';

export type MigrateContext = { pool: Pool };

/** Historial de migraciones SQL del stack Sequelize (runner: Umzug). */
const DEFAULT_TABLE = 'sequelize_migrations';

export class PgStorage implements UmzugStorage<MigrateContext> {
  constructor(
    private readonly pool: Pool,
    private readonly tableName = DEFAULT_TABLE,
  ) {}

  async logMigration({ name }: MigrationParams<MigrateContext>): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.quoteIdent(this.tableName)} (name, executed_at) VALUES ($1, NOW())`,
      [name],
    );
  }

  async unlogMigration({ name }: MigrationParams<MigrateContext>): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${this.quoteIdent(this.tableName)} WHERE name = $1`,
      [name],
    );
  }

  async executed({
    context,
  }: Pick<MigrationParams<MigrateContext>, 'context'>): Promise<string[]> {
    const { rows } = await context.pool.query<{ name: string }>(
      `SELECT name FROM ${this.quoteIdent(this.tableName)} ORDER BY executed_at ASC`,
    );
    return rows.map((r) => r.name);
  }

  private quoteIdent(ident: string): string {
    return `"${ident.replace(/"/g, '""')}"`;
  }
}

export async function ensureMigrationsTable(
  pool: Pool,
  tableName = DEFAULT_TABLE,
): Promise<void> {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${q(tableName)} (
      name TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
