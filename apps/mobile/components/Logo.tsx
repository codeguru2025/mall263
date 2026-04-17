import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Brand } from '@/constants/brand';

/** Shopping-bag mark — same paths as the web SVG logo. */
function BagMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Bag body layers — Zimbabwe flag stripe colours */}
      <Path d="M20 35L15 90C15 93 17 95 20 95H80C83 95 85 93 85 90L80 35H20Z" fill="#3B9AE1" />
      <Path d="M20 35L15 90C15 93 17 95 20 95H55L65 35H20Z" fill="#43A047" />
      <Path d="M35 50L15 90C15 93 17 95 20 95H45L55 50H35Z" fill="#FFC107" />
      <Path d="M40 60L15 90C15 93 17 95 20 95H35L45 60H40Z" fill="#F7941D" />
      <Path d="M42 65L15 90C15 93 17 95 20 95H30L40 65H42Z" fill="#E53935" />
      {/* Handle */}
      <Path
        d="M35 35C35 22 40 15 50 15C60 15 65 22 65 35"
        stroke="#1B2A4A"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Location pin */}
      <Circle cx="50" cy="62" r="14" fill="white" opacity="0.9" />
      <Path
        d="M50 52C45 52 41 56 41 61C41 68 50 76 50 76C50 76 59 68 59 61C59 56 55 52 50 52ZM50 64C48.3 64 47 62.7 47 61C47 59.3 48.3 58 50 58C51.7 58 53 59.3 53 61C53 62.7 51.7 64 50 64Z"
        fill="#F7941D"
      />
    </Svg>
  );
}

/** Full inline logo: bag mark + MALL263 wordmark. */
export function Logo({ size = 40 }: { size?: number }) {
  const fontSize = size * 0.5;
  return (
    <View style={styles.row}>
      <BagMark size={size} />
      <View style={[styles.wordmark, { gap: 0 }]}>
        <Text style={[styles.mall, { fontSize }]}>MALL</Text>
        <Text style={{ fontSize, fontWeight: '900' }}>
          <Text style={{ color: Brand.green }}>2</Text>
          <Text style={{ color: Brand.orange }}>6</Text>
          <Text style={{ color: Brand.red }}>3</Text>
        </Text>
      </View>
    </View>
  );
}

/** Just the bag icon — for tab headers / small spaces. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return <BagMark size={size} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { flexDirection: 'row', alignItems: 'baseline' },
  mall: { fontWeight: '900', color: Brand.navy },
});
