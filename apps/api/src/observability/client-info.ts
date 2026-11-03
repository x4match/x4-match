import type { IncomingHttpHeaders } from 'http';

export const CLIENT_PLATFORMS = [
  'ios',
  'android',
  'web',
  'web-club',
  'web-sponsors',
  'web-admin',
] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number] | 'unknown';

export interface ClientInfo {
  platform: ClientPlatform;
  appVersion: string | null;
}

const VERSION_PATTERN = /^[\w.+-]{1,32}$/;

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Lee `X-Client-Platform` / `X-App-Version`; valores desconocidos no generan series nuevas en Prometheus. */
export function readClientInfo(headers: IncomingHttpHeaders): ClientInfo {
  const rawPlatform = header(headers, 'x-client-platform')?.trim().toLowerCase();
  const platform = (CLIENT_PLATFORMS as readonly string[]).includes(rawPlatform ?? '')
    ? (rawPlatform as ClientPlatform)
    : 'unknown';
  const rawVersion = header(headers, 'x-app-version')?.trim();
  const appVersion = rawVersion && VERSION_PATTERN.test(rawVersion) ? rawVersion : null;
  return { platform, appVersion };
}
