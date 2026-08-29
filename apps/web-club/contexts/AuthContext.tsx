'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Cookies from 'js-cookie';
import { AUTH_COOKIE_MAX_AGE, TOKEN_COOKIE, USER_COOKIE } from '@/lib/auth-cookies';
import { setApiToken } from '@/lib/api';
import { isClub } from '@/lib/roles';
import type { AuthUser } from '@/lib/types';
import { makeQueryClient } from '@/lib/query-client';
import { useQueryClient } from '@tanstack/react-query';

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      const storedToken = Cookies.get(TOKEN_COOKIE) || null;
      const rawUser = Cookies.get(USER_COOKIE);
      if (storedToken && rawUser) {
        const parsed = JSON.parse(rawUser) as AuthUser;
        setToken(storedToken);
        setUser(parsed);
        setApiToken(storedToken);
      }
    } catch {
      Cookies.remove(TOKEN_COOKIE);
      Cookies.remove(USER_COOKIE);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    (newToken: string, newUser: AuthUser) => {
      Cookies.set(TOKEN_COOKIE, newToken, { expires: AUTH_COOKIE_MAX_AGE / 86400, sameSite: 'lax' });
      Cookies.set(USER_COOKIE, JSON.stringify(newUser), {
        expires: AUTH_COOKIE_MAX_AGE / 86400,
        sameSite: 'lax',
      });
      queryClient.clear();
      setToken(newToken);
      setUser(newUser);
      setApiToken(newToken);
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    Cookies.remove(TOKEN_COOKIE);
    Cookies.remove(USER_COOKIE);
    queryClient.clear();
    setToken(null);
    setUser(null);
    setApiToken(null);
  }, [queryClient]);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      Cookies.set(USER_COOKIE, JSON.stringify(next), {
        expires: AUTH_COOKIE_MAX_AGE / 86400,
        sameSite: 'lax',
      });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, updateUser }),
    [user, token, loading, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useIsClubUser() {
  const { user } = useAuth();
  return isClub(user?.role);
}

/** Stable query client holder for SSR-safe singleton on client */
export function getBrowserQueryClient() {
  return makeQueryClient();
}
