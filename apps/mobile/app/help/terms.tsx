import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/constants/brand';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. The service',
    body: 'Mall263 provides an online marketplace and related tools (such as wallet, demands, services, and seller POS features) connecting buyers and sellers in Zimbabwe. We may change or discontinue features when needed for security, compliance, or operations.',
  },
  {
    title: '2. Accounts',
    body: 'You must provide accurate information and keep your login details secure. You are responsible for activity on your account. We may suspend or restrict accounts that appear fraudulent, abusive, or harmful to other users or the platform.',
  },
  {
    title: '3. Listings and conduct',
    body: 'Sellers must describe goods and services honestly. Buyers and sellers must follow our messaging and contact rules designed to reduce scams and keep transactions on-platform where required. Illegal items, harassment, and attempts to bypass platform fees or safety controls are not allowed.',
  },
  {
    title: '4. Payments and wallet',
    body: 'Wallet and payment features are provided subject to partner rules, limits, and successful settlement. You agree that balances and transaction records maintained by the platform, together with payment partners, are used to resolve disputes unless a stronger proof is required by law.',
  },
  {
    title: '5. Disclaimer',
    body: 'The service is provided on an "as is" basis to the extent permitted by law. Mall263 is not liable for indirect losses, loss of profit, or issues arising solely between buyers and sellers off-platform. Nothing in these terms limits liability that cannot be limited under applicable law.',
  },
  {
    title: '6. Contact',
    body: 'For questions about these terms, use the in-app Help form or WhatsApp +263 71 217 1267.',
  },
];

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Terms of Service</Text>
        <Text style={styles.heroSub}>
          These terms describe how you may use Mall263. Your continued use of the platform means you
          agree to follow them and any notices we publish in the app.
        </Text>
      </View>

      <View style={styles.card}>
        {SECTIONS.map((s, i) => (
          <View key={i} style={[styles.section, i < SECTIONS.length - 1 && styles.sectionBorder]}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 40 },

  hero: { marginBottom: 14 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: Brand.navy, letterSpacing: -0.4 },
  heroSub: { fontSize: 13, color: Brand.muted, marginTop: 8, lineHeight: 19 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  section: { padding: 16 },
  sectionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.border },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: Brand.navy, marginBottom: 6 },
  sectionBody: { fontSize: 13, color: Brand.text, lineHeight: 19 },
});
