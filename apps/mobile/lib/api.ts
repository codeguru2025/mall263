import axios from 'axios';
import { getApiBaseUrl } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './token-storage';

/** Called when the session expires and cannot be silently refreshed. */
let _onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(cb: () => void) { _onAuthExpired = cb; }

/** baseURL is set per request so `getApiBaseUrl()` always matches current env / app.config extra. */
export const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${getApiBaseUrl()}/api/v1/auth/refresh`, { refreshToken });
    const access = data.accessToken as string;
    const refresh = data.refreshToken as string;
    await setTokens(access, refresh);
    return access;
  } catch (err: unknown) {
    // Only invalidate tokens when the server definitively rejects them (4xx).
    // A network error during refresh must not log the user out.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status && status >= 400 && status < 500) {
      await clearTokens();
    }
    return null;
  } finally {
    refreshPromise = null;
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = doRefresh();
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      _onAuthExpired?.();
    }
    return Promise.reject(error);
  },
);
