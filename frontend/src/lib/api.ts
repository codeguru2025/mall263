import axios from 'axios';

// Strip any accidental /api/v1 suffix — the env var should be the base domain only.
// DO dashboard may have it set with the suffix from a previous config.
const _rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const API_URL = _rawUrl.replace(/\/api\/v1\/?$/, '');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundaries; default application/json breaks FormData uploads.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Mutex to prevent concurrent refresh token requests.
// When multiple 401s fire simultaneously, only the first triggers a refresh;
// the rest wait for the same promise and reuse the new token.
let refreshPromise: Promise<string | null> | null = null;

function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return Promise.resolve(null);

  return axios
    .post(`${API_URL}/api/v1/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      return data.accessToken as string;
    })
    .catch(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
