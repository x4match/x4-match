import axios from 'axios';
import Cookies from 'js-cookie';
import { TOKEN_COOKIE } from './auth-cookies';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_COOKIE);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setApiToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export function getApiErrorMessage(error: unknown, fallback = 'No se pudo cargar el listado') {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
