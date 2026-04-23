import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { Brand } from '@/constants/brand';

/**
 * Web variant of MapViewSafe. `react-native-maps` contains native-only imports
 * (`codegenNativeCommands`, etc.) that Metro cannot bundle for web. To keep
 * the web build alive we ship this stub instead — Metro automatically resolves
 * `*.web.tsx` over `*.tsx` when the platform is web.
 */

type AnyProps = Record<string, unknown> & { children?: ReactNode; style?: unknown };

const StubMap: ComponentType<AnyProps> = ({ children, style }) => (
  <View style={[styles.stub, style as ViewProps['style']]}>
    <Text style={styles.stubTitle}>Map preview</Text>
    <Text style={styles.stubHint}>Open the app on iOS or Android to see the live map.</Text>
    {children}
  </View>
);

const StubChild: ComponentType<AnyProps> = () => null;

export const MapView = StubMap;
export const Marker = StubChild;
export const Circle = StubChild;
export const Polyline = StubChild;
export const PROVIDER_GOOGLE: unknown = 'google';
export const PROVIDER_DEFAULT: unknown = undefined;
export const isMapAvailable = false;
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
