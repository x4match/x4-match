import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    const common = {
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30_000,
      max: 10,
    };
    this.pool = new Pool(
      connectionString
        ? { connectionString, ...common }
        : {
            host: this.configService.get<string>('DB_HOST', 'localhost'),
            port: Number(this.configService.get<string>('DB_PORT', '5432')),
            database: this.configService.get<string>('DB_NAME', 'playtomic_db'),
            user: this.configService.get<string>('DB_USER', 'user'),
            password: this.configService.get<string>('DB_PASSWORD', 'password'),
            ...common,
          },
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `No se pudo conectar a PostgreSQL (${msg}). ¿Está Postgres en marcha? (p. ej. docker compose en infra/)`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }
}
