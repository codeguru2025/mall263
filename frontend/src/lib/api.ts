import axios from 'axios';

// Strip any accidental /api/v1 suffix — the env var should be the base domain only.
const _rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const API_URL = _rawUrl.replace(/\/api\/v1\/?$/, '');

// Access token is stored in memory only — never in localStorage.
// This protects against XSS token theft. The refresh token lives in an
// httpOnly cookie set by the backend, so it is never readable by JS.
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}
export function getAccessToken(): string | null {
  return _accessToken;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // Send the httpOnly refresh-token cookie on every request to the same origin.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  // Let the browser set multipart boundaries; default application/json breaks FormData uploads.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Mutex to prevent concurrent refresh token requests.
let refreshPromise: Promise<string | null> | null = null;

function doRefresh(): Promise<string | null> {
  // POST with no body — the httpOnly cookie is sent automatically.
  return axios
    .post(`${API_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
    .then(({ data }) => {
      setAccessToken(data.accessToken);
      return data.accessToken as string;
    })
    .catch(() => {
      setAccessToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = doRefresh();
      }

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
