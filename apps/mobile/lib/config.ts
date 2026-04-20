import Constants from 'expo-constants';

/**
 * API origin only (no `/api/v1` suffix), same as web `NEXT_PUBLIC_API_URL`.
 * Order: Metro-inlined env → `app.config.ts` extra (always set; defaults to DO prod) → localhost.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  const raw = (fromEnv || fromExtra || 'http://localhost:4000')
    .trim()
    .replace(/\/$/, '')
    .replace(/\/api\/v1\/?$/, '');
  try {
    new URL(raw);
  } catch {
    return 'http://localhost:4000';
  }
  return raw;
}
