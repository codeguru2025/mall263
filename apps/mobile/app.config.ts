import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require('./app.json').expo as ExpoConfig;

/** Same host as web on DO; override with EXPO_PUBLIC_API_URL in .env for other environments. */
const DEFAULT_PUBLIC_API = 'https://mall263-r99jz.ondigitalocean.app';

const apiBaseUrl = String(process.env.EXPO_PUBLIC_API_URL || DEFAULT_PUBLIC_API)
  .trim()
  .replace(/\/$/, '')
  .replace(/\/api\/v1\/?$/, '');

export default {
  expo: {
    ...base,
    extra: {
      ...(typeof base.extra === 'object' && base.extra ? (base.extra as Record<string, unknown>) : {}),
      apiBaseUrl,
    },
  },
};
