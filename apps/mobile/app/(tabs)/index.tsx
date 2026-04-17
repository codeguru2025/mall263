import { ScrollView, StyleSheet, View, Text, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';
import { Logo } from '@/components/Logo';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 }
    : { elevation: 3 };

// Zimbabwe flag stripe colours — green / yellow / red / black
const ZW_STRIPE_COLORS = ['#006400', '#FFD200', '#EF3340', '#000000'];

function ZimStripes() {
  return (
    <View style={styles.stripes}>
      {ZW_STRIPE_COLORS.map((c) => (
        <View key={c} style={[styles.stripe, { backgroundColor: c }]} />
      ))}
    </View>
  );
}

type QuickLink = {
  label: string;
  icon: string;
  desc: string;
  route: '/(tabs)/shop' | '/(tabs)/demands' | '/(tabs)/wallet' | '/(tabs)/profile';
};

const QUICK_LINKS: QuickLink[] = [
  { label: 'Shop', icon: '🛍️', desc: 'Browse the marketplace', route: '/(tabs)/shop' },
  { label: 'Demands', icon: '📢', desc: 'Post or bid on demands', route: '/(tabs)/demands' },
  { label: 'Wallet', icon: '💳', desc: 'Balances & history', route: '/(tabs)/wallet' },
  { label: 'Profile', icon: '👤', desc: 'Settings & Driver Hub', route: '/(tabs)/profile' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero card */}
      <View style={[styles.hero, cardShadow]}>
        <ZimStripes />

        <View style={styles.heroBody}>
          <View style={styles.logoPanel}>
            <Logo size={48} />
          </View>
          <Text style={styles.tagline}>Zimbabwe's marketplace{'\n'}Find it. Bid on it. Get it.</Text>
        </View>
      </View>

      {/* Welcome card */}
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.cardLabel}>Welcome back</Text>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{user?.role?.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {/* Quick-link grid */}
      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.grid}>
        {QUICK_LINKS.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.quickCard,
              cardShadow,
              pressed && styles.quickCardPressed,
            ]}
            onPress={() => router.push(item.route as never)}
            android_ripple={{ color: Brand.border, borderless: false }}
          >
            <Text style={styles.quickIcon}>{item.icon}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
            <Text style={styles.quickDesc}>{item.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Flag colour band at bottom */}
      <View style={styles.bottomBand}>
        {ZW_STRIPE_COLORS.map((c) => (
          <View key={c} style={[styles.bottomStripe, { backgroundColor: c }]} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  stripes: { flexDirection: 'row', height: 6 },
  stripe: { flex: 1 },
  heroBody: { padding: 22, gap: 14, alignItems: 'flex-start' },
  logoPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagline: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500', lineHeight: 20 },

  // Welcome card
  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 20,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 22, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  phone: { fontSize: 15, color: Brand.muted, marginTop: 4 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: Brand.pageBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: Brand.blue, textTransform: 'capitalize' },

  // Quick links
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.navy, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickCard: {
    width: '47%',
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  quickCardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  quickIcon: { fontSize: 26, marginBottom: 8 },
  quickLabel: { fontSize: 15, fontWeight: '800', color: Brand.navy, marginBottom: 2 },
  quickDesc: { fontSize: 12, color: Brand.muted },

  // Bottom band
  bottomBand: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden' },
  bottomStripe: { flex: 1 },
});
