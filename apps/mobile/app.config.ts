import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require('./app.json').expo as ExpoConfig;

/** Same host as web on DO; override with EXPO_PUBLIC_API_URL in .env for other environments. */
const DEFAULT_PUBLIC_API = 'https://mall263-r99jz.ondigitalocean.app';

const apiBaseUrl = String(process.env.EXPO_PUBLIC_API_URL || DEFAULT_PUBLIC_API)
  .trim()
  .replace(/\/$/, '')
  .replace(/\/api\/v1\/?$/, '');

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const mapProvider = process.env.EXPO_PUBLIC_MAP_PROVIDER ?? 'google';

export default {
  expo: {
    ...base,
    owner: 'gustozw',
    updates: {
      url: 'https://u.expo.dev/7b563715-3473-46df-8c9b-4ea2564462c0',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    android: {
      ...(typeof base.android === 'object' && base.android ? base.android : {}),
      config: {
        googleMaps: { apiKey: googleMapsKey },
      },
    },
    ios: {
      ...(typeof base.ios === 'object' && base.ios ? base.ios : {}),
      config: {
        googleMapsApiKey: googleMapsKey,
      },
    },
    plugins: (Array.isArray(base.plugins) ? base.plugins : []).map((p) => {
      if (Array.isArray(p) && p[0] === 'react-native-maps') {
        return ['react-native-maps', { googleMapsApiKey: googleMapsKey }];
      }
      return p;
    }),
    extra: {
      ...(typeof base.extra === 'object' && base.extra ? (base.extra as Record<string, unknown>) : {}),
      apiBaseUrl,
      sentryDsn,
      mapProvider,
      eas: {
        projectId: '7b563715-3473-46df-8c9b-4ea2564462c0',
      },
    },
  },
};
