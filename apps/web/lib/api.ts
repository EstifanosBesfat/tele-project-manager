import axios from 'axios';
import { clearAuth } from './auth-storage';

const VERCEL_API_URL = 'https://teleprojectmanager-three.vercel.app/api';
const LOCAL_API_URL = 'http://localhost:4000/api';

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

  // Stale Railway deploys leave this env set on Vercel — ignore it.
  if (fromEnv && !fromEnv.includes('railway.app')) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'production') {
    return VERCEL_API_URL;
  }

  return fromEnv ?? LOCAL_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.startsWith('/auth')) {
        clearAuth();
        const callback = encodeURIComponent(path + window.location.search);
        window.location.href = `/auth/signin?callbackUrl=${callback}`;
      }
    }
    return Promise.reject(error);
  },
);

export function getSwaggerUrl(): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  if (base.endsWith('/api')) {
    return `${base}/docs`;
  }
  return `${base}/api/docs`;
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
