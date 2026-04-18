import { ScrollView, StyleSheet, View, Text, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';
import { Logo } from '@/components/Logo';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12 }
    : { elevation: 3 };

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
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  desc: string;
  tint: string;
  tintBg: string;
  route: '/(tabs)/shop' | '/(tabs)/demands' | '/(tabs)/wallet' | '/(tabs)/profile';
};

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Shop',
    icon: 'shopping-bag',
    desc: 'Browse the marketplace',
    tint: '#3B9AE1',
    tintBg: '#e6f1fb',
    route: '/(tabs)/shop',
  },
  {
    label: 'Demands',
    icon: 'bullhorn',
    desc: 'Post or bid on demands',
    tint: '#F7941D',
    tintBg: '#fdefdb',
    route: '/(tabs)/demands',
  },
  {
    label: 'Wallet',
    icon: 'credit-card',
    desc: 'Balances & history',
    tint: '#43A047',
    tintBg: '#e4f3e5',
    route: '/(tabs)/wallet',
  },
  {
    label: 'Profile',
    icon: 'user-circle',
    desc: 'Settings & Driver Hub',
    tint: '#1B2A4A',
    tintBg: '#e6e9f1',
    route: '/(tabs)/profile',
  },
];

export default function HomeScreen() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  if (!isAuthenticated) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, cardShadow]}>
          <ZimStripes />
          <View style={styles.heroBody}>
            <View style={styles.logoPanel}><Logo size={44} /></View>
            <Text style={styles.heroEyebrow}>Zimbabwe's marketplace</Text>
            <Text style={styles.heroTitle}>Find it. Bid on it. Get it.</Text>
          </View>
        </View>
        <View style={[styles.welcome, cardShadow]}>
          <Text style={styles.welcomeEyebrow}>Get more from Mall263</Text>
          <Text style={styles.welcomeName}>Sign in to your account</Text>
          <Text style={[styles.welcomePhone, { marginTop: 4 }]}>Access your wallet, post demands and manage your stall.</Text>
          <Pressable style={[styles.guestBtn]} onPress={() => router.push('/login')}>
            <Text style={styles.guestBtnText}>Sign In</Text>
          </Pressable>
          <Pressable style={[styles.guestBtnOutline]} onPress={() => router.push('/register')}>
            <Text style={styles.guestBtnOutlineText}>Create Account</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.shopBanner, cardShadow]} onPress={() => router.push('/(tabs)/shop')}>
          <FontAwesome name="shopping-bag" size={22} color={Brand.blue} />
          <Text style={styles.shopBannerText}>Browse the Marketplace →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'there';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, cardShadow]}>
        <ZimStripes />
        <View style={styles.heroBody}>
          <View style={styles.logoPanel}>
            <Logo size={44} />
          </View>
          <Text style={styles.heroEyebrow}>Zimbabwe’s marketplace</Text>
          <Text style={styles.heroTitle}>Find it. Bid on it. Get it.</Text>
        </View>
      </View>

      <View style={[styles.welcome, cardShadow]}>
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcomeEyebrow}>Welcome back</Text>
            <Text style={styles.welcomeName}>{displayName}</Text>
            {user?.phone ? <Text style={styles.welcomePhone}>{user.phone}</Text> : null}
          </View>
          {user?.role ? (
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>
                {user.role.replace(/_/g, ' ').toLowerCase()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.grid}>
        {QUICK_LINKS.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }: { pressed: boolean }) => [
              styles.quickCard,
              cardShadow,
              pressed && styles.quickCardPressed,
            ]}
            onPress={() => router.push(item.route as never)}
            android_ripple={{ color: Brand.border, borderless: false }}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.tintBg }]}>
              <FontAwesome name={item.icon} size={22} color={item.tint} />
            </View>
            <Text style={styles.quickLabel}>{item.label}</Text>
            <Text style={styles.quickDesc} numberOfLines={2}>
              {item.desc}
            </Text>
          </Pressable>
        ))}
      </View>

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

  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
  },
  stripes: { flexDirection: 'row', height: 5 },
  stripe: { flex: 1 },
  heroBody: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, gap: 12, alignItems: 'flex-start' },
  logoPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.4,
  },

  welcome: {
    backgroundColor: Brand.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 22,
  },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  welcomeEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  welcomeName: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginTop: 4, letterSpacing: -0.3 },
  welcomePhone: { fontSize: 14, color: Brand.muted, marginTop: 2 },
  rolePill: {
    backgroundColor: Brand.pageBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  roleText: { fontSize: 11, fontWeight: '800', color: Brand.blue, textTransform: 'capitalize' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickCard: {
    width: '47.8%',
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 4,
  },
  quickCardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickLabel: { fontSize: 16, fontWeight: '900', color: Brand.navy, letterSpacing: -0.2 },
  quickDesc: { fontSize: 12, color: Brand.muted, lineHeight: 17 },

  bottomBand: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden' },
  bottomStripe: { flex: 1 },

  guestBtn: {
    backgroundColor: Brand.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  guestBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  guestBtnOutline: {
    borderWidth: 1.5,
    borderColor: Brand.navy,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  guestBtnOutlineText: { color: Brand.navy, fontSize: 16, fontWeight: '800' },
  shopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 24,
  },
  shopBannerText: { fontSize: 16, fontWeight: '800', color: Brand.blue },
});
