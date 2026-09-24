import axios from 'axios';
import Cookies from 'js-cookie';
import { TOKEN_COOKIE } from './auth-cookies';

function resolveApiUrl() {
  let url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  // Avoid mixed content: HTTPS pages cannot call http://api.*
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    try {
      const parsed = new URL(url);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (!isLocal) {
        parsed.protocol = 'https:';
        url = parsed.toString().replace(/\/$/, '');
      }
    } catch {
      url = url.replace(/^http:\/\//, 'https://');
    }
  }
  return url;
}

const API_URL = resolveApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_COOKIE);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export function setApiToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
