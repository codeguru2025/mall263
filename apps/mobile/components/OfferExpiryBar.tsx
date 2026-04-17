import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatOfferTimeLeft,
  offerExpiryUrgencyTier,
  offerRemainingMs,
  offerValidityRemainingFraction,
} from '@mall263/shared';
import { Brand } from '@/constants/brand';

type Props = {
  createdAt: string;
  expiresAt: string;
};

export function OfferExpiryBar({ createdAt, expiresAt }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const fraction = offerValidityRemainingFraction(createdAt, expiresAt, now);
  const msLeft = offerRemainingMs(expiresAt, now);
  const tier = offerExpiryUrgencyTier(fraction);
  const pct = Math.max(0, Math.min(100, fraction * 100));

  const fillColor = tier === 'critical' ? Brand.red : tier === 'high' ? Brand.orange : Brand.blue;
  const labelColor = fillColor;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>Offer expires</Text>
        <Text style={[styles.time, { color: labelColor }]}>{formatOfferTimeLeft(msLeft)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              marginLeft: `${100 - pct}%`,
              backgroundColor: fillColor,
              opacity: tier === 'critical' ? 0.95 : 1,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  time: { fontSize: 11, fontWeight: '800' },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Brand.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
