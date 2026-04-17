import Constants from 'expo-constants';
import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { Brand } from '@/constants/brand';

/**
 * Safe wrapper around `react-native-maps`.
 *
 * `react-native-maps` is a native module and is **not available in Expo Go**.
 * To keep the app testable via Expo Go (and crash-free for web), we dynamically
 * load the real library only when we're in a dev-client / standalone build.
 * Otherwise we render a styled placeholder with a helpful hint.
 *
 * In production builds (EAS / `expo run:android`), the real maps are used and
 * this file is transparent.
 */

type AnyProps = Record<string, unknown> & { children?: ReactNode; style?: unknown };

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

let RNMaps: {
  default: ComponentType<AnyProps>;
  Marker: ComponentType<AnyProps>;
  Circle: ComponentType<AnyProps>;
  Polyline: ComponentType<AnyProps>;
  PROVIDER_GOOGLE: unknown;
  PROVIDER_DEFAULT: unknown;
} | null = null;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RNMaps = require('react-native-maps');
  } catch {
    RNMaps = null;
  }
}

const StubMap = ({ children, style }: AnyProps) => (
  <View style={[styles.stub, style as ViewProps['style']]}>
    <Text style={styles.stubTitle}>Map preview</Text>
    <Text style={styles.stubHint}>
      Live map available in the dev-client / production build.
    </Text>
    {children}
  </View>
);

const StubChild = () => null;

const MapView = RNMaps?.default ?? StubMap;
const Marker = RNMaps?.Marker ?? StubChild;
const Circle = RNMaps?.Circle ?? StubChild;
const Polyline = RNMaps?.Polyline ?? StubChild;
const PROVIDER_GOOGLE = RNMaps?.PROVIDER_GOOGLE ?? 'google';
const PROVIDER_DEFAULT = RNMaps?.PROVIDER_DEFAULT ?? undefined;

export { MapView, Marker, Circle, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT };
export const isMapAvailable = RNMaps != null;
export default MapView;

const styles = StyleSheet.create({
  stub: {
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  stubTitle: {
    color: Brand.navy,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  stubHint: {
    color: Brand.muted,
    fontSize: 11,
    textAlign: 'center',
  },
});
