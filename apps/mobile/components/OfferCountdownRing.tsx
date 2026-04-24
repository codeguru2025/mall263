import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  formatOfferTimeLeft,
  offerExpiryUrgencyTier,
  offerRemainingMs,
  offerValidityRemainingFraction,
} from '@mall263/shared';

const SIZE = 64;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Props = {
  createdAt: string;
  expiresAt: string;
};

export function OfferCountdownRing({ createdAt, expiresAt }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const fraction = offerValidityRemainingFraction(createdAt, expiresAt, now);
  const msLeft = offerRemainingMs(expiresAt, now);
  const tier = offerExpiryUrgencyTier(fraction);
  const pct = Math.max(0, Math.min(1, fraction));

  const ringColor =
    tier === 'critical' ? '#ef4444' : tier === 'high' ? '#f97316' : '#16a34a';
  const trackColor = tier === 'critical' ? '#fee2e2' : tier === 'high' ? '#ffedd5' : '#dcfce7';

  // Remaining arc: starts at top (rotate -90°), depletes clockwise
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  const timeLabel = formatOfferTimeLeft(msLeft);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        {/* Track ring */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={trackColor}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress arc — rotated so 12 o'clock is the start */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={ringColor}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      {/* Time label in the centre */}
      <View style={styles.center}>
        <Text style={[styles.timeText, { color: ringColor }]} numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, position: 'relative' },
  svg: { position: 'absolute', top: 0, left: 0 },
  center: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
