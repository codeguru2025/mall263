import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/api';
import { clearTokens, getAccessToken, setTokens } from '@/lib/token-storage';
import type { MeProfile } from '@/lib/me-profile';

/** Session user — same payload as `GET /api/v1/users/me` after login. */
export type AuthUser = MeProfile;

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const reloadUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get<MeProfile>('/api/v1/users/me');
      setUser(data);
    } catch {
      await clearTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reloadUser();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadUser]);

  const login = useCallback(async (phone: string, password: string) => {
    const normalized = phone.trim().replace(/[\s\-().]/g, '');
    const { data } = await api.post('/api/v1/auth/login', {
      phone: normalized,
      password,
    });
    await setTokens(data.accessToken, data.refreshToken);
    const { data: me } = await api.get<MeProfile>('/api/v1/users/me');
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      /* network / 401 — still clear local session */
    }
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      isAuthenticated: !!user,
      user,
      login,
      logout,
      reloadUser,
    }),
    [isReady, user, login, logout, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
