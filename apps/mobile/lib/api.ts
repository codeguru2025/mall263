import axios from 'axios';
import { getApiBaseUrl } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './token-storage';

/** Called at most once when the session expires and cannot be silently refreshed. */
let _onAuthExpired: (() => void) | null = null;
let _expiredFired = false;

export function setOnAuthExpired(cb: () => void) {
  _onAuthExpired = cb;
  _expiredFired = false; // new auth context mount — reset the guard
}

/** Reset so the next genuine expiry triggers the callback (call after successful login). */
export function resetAuthExpiredGuard() {
  _expiredFired = false;
}

/** Fire at most once per session — prevents multiple concurrent 401s from calling the
 *  callback several times and causing repeated router.replace('/login') flashes. */
function fireAuthExpired() {
  if (_expiredFired) return;
  _expiredFired = true;
  _onAuthExpired?.();
}

/** baseURL is set per request so `getApiBaseUrl()` always matches the current env. */
export const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

/**
 * Returns the new access token on success.
 * Returns null on failure.
 *   - 4xx from the server   → tokens cleared from storage (definitive expiry)
 *   - network / 5xx error   → tokens left intact (transient failure, stay logged in)
 *   - no refresh token      → null (session already gone)
 */
async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${getApiBaseUrl()}/api/v1/auth/refresh`, { refreshToken });
    const access = data.accessToken as string;
    const refresh = data.refreshToken as string;
    await setTokens(access, refresh);
    // Successful renewal — arm the guard so a future expiry can fire again.
    _expiredFired = false;
    return access;
  } catch (err: unknown) {
    // Only clear stored tokens when the server definitively rejects them (4xx).
    // Network / 5xx errors are transient — leave the tokens intact so the user
    // stays logged in and the next foreground resume can retry.
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
      // `doRefresh` returned null — decide whether this is a definitive expiry.
      // If it was a network error, the refresh token is still in storage.
      // If it was a 4xx, clearTokens() was called and storage is now empty.
      // Checking storage is the canonical signal — no separate flag needed.
      const stillHasRefreshToken = await getRefreshToken();
      if (!stillHasRefreshToken) {
        fireAuthExpired();
      }
      // network error: refresh token intact → don't log the user out
    }
    return Promise.reject(error);
  },
);
