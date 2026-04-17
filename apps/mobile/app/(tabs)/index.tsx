import { StyleSheet, View, Text, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.logo}>Mall263</Text>
        <Text style={styles.tagline}>Find it. Bid on it. Get it.</Text>
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.cardLabel}>Signed in</Text>
        <Text style={styles.name}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{user?.role?.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Shop, Demands (post & accept offers), Alerts, Profile — same API as the website.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Brand.pageBg,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
  },
  logo: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6, fontWeight: '500' },
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
  hint: {
    fontSize: 14,
    color: Brand.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
});
