import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, resetAuthExpiredGuard, setOnAuthExpired } from '@/lib/api';
import { clearTokens, getAccessToken, setTokens } from '@/lib/token-storage';
import { router } from 'expo-router';
import { registerForPushNotifications, savePushTokenToBackend } from '@/lib/push';
import type { MeProfile } from '@/lib/me-profile';

/** Session user — same payload as `GET /api/v1/users/me` after login. */
export type AuthUser = MeProfile;

export type RegisterPayload = {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'BUYER' | 'STALL_OWNER' | 'DELIVERY_DRIVER' | 'FIELD_AGENT';
  avatarUrl?: string;
};

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (phone: string, password: string) => Promise<MeProfile>;
  register: (payload: RegisterPayload) => Promise<void>;
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
    } catch (err: unknown) {
      // Only treat a definitive server auth rejection as session expiry.
      // Network / 5xx errors must NOT log the user out — a connectivity blip
      // should never silently clear a valid session.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        await clearTokens();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    setOnAuthExpired(async () => {
      await clearTokens();
      setUser(null);
      router.replace('/login');
    });
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
    resetAuthExpiredGuard(); // new session — re-arm the expiry guard
    const { data: me } = await api.get<MeProfile>('/api/v1/users/me');
    setUser(me);
    // Register push token now that we have a valid session
    registerForPushNotifications().then((token) => {
      if (token) savePushTokenToBackend(token);
    });
    return me;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const normalized = payload.phone.trim().replace(/[\s\-().]/g, '');
    const body: Record<string, unknown> = {
      phone: normalized,
      password: payload.password,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
    };
    if (payload.role) body.role = payload.role;
    if (payload.avatarUrl) body.avatarUrl = payload.avatarUrl;
    const { data } = await api.post('/api/v1/auth/register', body);
    if (data?.accessToken) {
      await setTokens(data.accessToken, data.refreshToken);
      resetAuthExpiredGuard(); // new session — re-arm the expiry guard
      const { data: me } = await api.get<MeProfile>('/api/v1/users/me');
      setUser(me);
      registerForPushNotifications().then((token) => {
        if (token) savePushTokenToBackend(token);
      });
    } else {
      // Backend didn't return tokens — fall back to a normal login.
      await login(normalized, payload.password);
    }
  }, [login]);

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
      register,
      logout,
      reloadUser,
    }),
    [isReady, user, login, register, logout, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
