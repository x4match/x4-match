const enabled = typeof __DEV__ !== 'undefined' && __DEV__;

function stamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export function redactForLog(value: unknown): unknown {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactForLog);
  }
  const secretKeys = new Set([
    'password',
    'confirmPassword',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'idToken',
    'id_token',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeys.has(key) || secretKeys.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else {
      out[key] = redactForLog(nested);
    }
  }
  return out;
}

export function devLog(scope: string, message: string, extra?: unknown): void {
  if (!enabled) return;
  if (extra !== undefined) {
    console.log(`[${stamp()}] [${scope}] ${message}`, extra);
  } else {
    console.log(`[${stamp()}] [${scope}] ${message}`);
  }
}

export function devWarn(scope: string, message: string, extra?: unknown): void {
  if (!enabled) return;
  if (extra !== undefined) {
    console.warn(`[${stamp()}] [${scope}] ${message}`, extra);
  } else {
    console.warn(`[${stamp()}] [${scope}] ${message}`);
  }
}

export function describeAxiosError(error: any): string {
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message))) {
    return 'La API no respondió a tiempo. ¿Está corriendo el backend?';
  }
  if (!error?.response) {
    return `Sin respuesta de la API (${error?.message || 'network error'}). Revisá EXPO_PUBLIC_API_URL y que el emulador alcance esa IP.`;
  }
  const body = error.response.data?.message;
  if (typeof body === 'string') return body;
  if (body) return JSON.stringify(body);
  return `Error ${error.response.status} al crear cuenta`;
}
