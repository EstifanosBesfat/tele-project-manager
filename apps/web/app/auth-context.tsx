'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/api';
import {
  type AuthUser,
  clearAuth,
  clearStoredToken,
  getStoredUser,
  setAuth,
} from '@/lib/auth-storage';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clearStoredToken();
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<AuthUser>('/users/me');
        if (cancelled) return;
        setAuth('', data);
        setUser(data);
      } catch {
        if (cancelled) return;
        clearAuth();
        setUser(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      { email, password },
    );
    setAuth(data.accessToken, data.user);
    setToken(null);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data } = await api.post<{ accessToken: string; user: AuthUser }>(
        '/auth/register',
        { name, email, password },
      );
      setAuth(data.accessToken, data.user);
      setToken(null);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(() => {
    void api.post('/auth/logout').catch(() => undefined);
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<AuthUser>('/users/me');
      setAuth('', data);
      setUser(data);
    } catch {
      // ignore — interceptor handles 401
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
