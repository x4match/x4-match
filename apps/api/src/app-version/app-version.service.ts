import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { APP_VERSION_PATTERN, UpdateAppVersionDto } from './dto/app-version.dto';

const SETTING_KEY = 'app.versions';

export type AppPlatform = 'ios' | 'android';

export interface AppPlatformVersion {
  latestVersion: string | null;
  minVersion: string | null;
  storeUrl: string | null;
}

export interface AppVersionConfig {
  ios: AppPlatformVersion;
  android: AppPlatformVersion;
  /** Texto opcional que acompaña la sugerencia de actualizar. */
  message: string | null;
}

const DEFAULT_CONFIG: AppVersionConfig = {
  ios: { latestVersion: null, minVersion: null, storeUrl: null },
  android: {
    latestVersion: null,
    minVersion: null,
    storeUrl: 'https://play.google.com/store/apps/details?id=x4.match',
  },
  message: null,
};

/** Compara versiones numéricas tipo 1.2.3. Devuelve <0, 0 o >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function sanitizeVersion(value: unknown): string | null {
  return typeof value === 'string' && APP_VERSION_PATTERN.test(value) ? value : null;
}

function sanitizePlatform(value: unknown, fallback: AppPlatformVersion): AppPlatformVersion {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    latestVersion: sanitizeVersion(raw.latestVersion),
    minVersion: sanitizeVersion(raw.minVersion),
    storeUrl: typeof raw.storeUrl === 'string' && raw.storeUrl ? raw.storeUrl : fallback.storeUrl,
  };
}

@Injectable()
export class AppVersionService {
  constructor(private readonly db: DatabaseService) {}

  async getConfig(): Promise<AppVersionConfig> {
    const result = await this.db.query<{ value: unknown }>(
      `SELECT value FROM platform_settings WHERE key = $1`,
      [SETTING_KEY],
    );
    const raw = (result.rows[0]?.value ?? {}) as Record<string, unknown>;
    return {
      ios: sanitizePlatform(raw.ios, DEFAULT_CONFIG.ios),
      android: sanitizePlatform(raw.android, DEFAULT_CONFIG.android),
      message: typeof raw.message === 'string' && raw.message ? raw.message : null,
    };
  }

  async updateConfig(dto: UpdateAppVersionDto, adminUserId: string): Promise<AppVersionConfig> {
    const current = await this.getConfig();
    const next: AppVersionConfig = {
      ios: { ...current.ios, ...stripUndefined(dto.ios) },
      android: { ...current.android, ...stripUndefined(dto.android) },
      message: dto.message === undefined ? current.message : dto.message,
    };

    for (const platform of ['ios', 'android'] as const) {
      const { latestVersion, minVersion } = next[platform];
      if (latestVersion && minVersion && compareVersions(minVersion, latestVersion) > 0) {
        throw new BadRequestException(
          `En ${platform === 'ios' ? 'iOS' : 'Android'} la versión mínima no puede ser mayor que la última.`,
        );
      }
    }

    await this.db.query(
      `INSERT INTO platform_settings (key, value, updated_by_user_id, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_by_user_id = EXCLUDED.updated_by_user_id,
             updated_at = NOW()`,
      [SETTING_KEY, JSON.stringify(next), adminUserId],
    );
    return next;
  }
}

function stripUndefined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
