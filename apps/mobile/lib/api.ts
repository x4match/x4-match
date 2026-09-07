import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { devLog, devWarn, redactForLog } from '@/lib/debug';

type TimedRequestConfig = InternalAxiosRequestConfig & { __startedAt?: number };

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Host del PC donde corre Metro (útil en Expo Go / dispositivo físico). */
function deriveDevMachineHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

/**
 * En móvil, localhost no es tu máquina de desarrollo. Sustituimos por la IP
 * que expone Expo o, en emulador Android, por 10.0.2.2.
 */
function resolveDevApiUrl(raw: string): string {
  let url = stripTrailingSlash(raw);

  if (Platform.OS === 'web') {
    return url;
  }

  if (!/localhost|127\.0\.0\.1/.test(url)) {
    return url;
  }

  const devHost = deriveDevMachineHost();
  if (devHost) {
    try {
      const parsed = new URL(url);
      const port = parsed.port;
      return `${parsed.protocol}//${devHost}${port ? `:${port}` : ''}`;
    } catch {
      /* seguir con fallbacks */
    }
  }

  if (Platform.OS === 'android') {
    return url
      .replace(/localhost/g, '10.0.2.2')
      .replace(/127\.0\.0\.1/g, '10.0.2.2');
  }

  return url;
}

export const API_URL = __DEV__
  ? resolveDevApiUrl(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000')
  : stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000');

const REQUEST_TIMEOUT_MS = 20_000;

export const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (__DEV__) {
  devLog('api', `baseURL=${API_URL} (env=${process.env.EXPO_PUBLIC_API_URL || 'unset'})`);
}

api.interceptors.request.use((config) => {
  const timed = config as TimedRequestConfig;
  timed.__startedAt = Date.now();
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  if (__DEV__) {
    const method = (config.method || 'get').toUpperCase();
    devLog('api', `→ ${method} ${config.baseURL ?? API_URL}${config.url ?? ''}`, {
      params: config.params,
      data: redactForLog(config.data),
    });
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const started = (response.config as TimedRequestConfig).__startedAt;
      const ms = started ? Date.now() - started : undefined;
      const method = (response.config.method || 'get').toUpperCase();
      devLog(
        'api',
        `← ${response.status} ${method} ${response.config.url ?? ''} ${ms != null ? `${ms}ms` : ''}`,
      );
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      const cfg = error.config as TimedRequestConfig | undefined;
      const started = cfg?.__startedAt;
      const ms = started ? Date.now() - started : undefined;
      const method = (cfg?.method || 'get').toUpperCase();
      const url = cfg?.url ?? '';
      if (error.response) {
        devWarn(
          'api',
          `← ${error.response.status} ${method} ${url} ${ms != null ? `${ms}ms` : ''}`,
          redactForLog(error.response.data),
        );
      } else {
        devWarn('api', `✕ ${method} ${url} ${error.code || 'NO_RESPONSE'} ${ms != null ? `${ms}ms` : ''}`, {
          message: error.message,
        });
      }
    }
    return Promise.reject(error);
  }
);

