import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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

const API_URL = __DEV__
  ? resolveDevApiUrl(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000')
  : stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000');

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      // El AuthContext manejará el logout
    }
    return Promise.reject(error);
  }
);

