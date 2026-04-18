import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I pay for something on Mall263?',
    a: 'Most purchases use your in-app wallet. You can fund your wallet from supported mobile money or bank methods where available. Sellers may also accept cash at pickup depending on the listing.',
  },
  {
    q: 'How do I become a seller?',
    a: 'Create an account and choose the seller (stall owner) path during registration. Complete your stall details and list your products. Our team or a field agent may verify your stall before you go live.',
  },
  {
    q: 'What is a "demand"?',
    a: 'Buyers can post what they are looking for. Sellers submit offers. If you accept an offer, the platform rules around wallet holds and messaging apply until the deal is completed.',
  },
  {
    q: 'I cannot log in or I forgot my password.',
    a: 'Use the phone-based login flow on the sign-in page. If you are still stuck, use the in-app Help form or WhatsApp our support line so we can verify your account safely.',
  },
  {
    q: 'How do disputes work?',
    a: 'If a delivery goes wrong, open a dispute from the tracking screen. Our team reviews the evidence and either releases the wallet hold, refunds, or asks for more info — usually within 24 hours.',
  },
  {
    q: 'How do I become a driver?',
    a: 'Open Profile → Become a driver, pick your vehicle, and upload a clear photo of your ID or licence. You can start accepting jobs once KYC is approved.',
  },
  {
    q: 'How do I contact support?',
    a: 'Use the Help form inside the app to describe your issue, or message us on WhatsApp at +263 71 217 1267. Please do not share passwords or one-time PINs with anyone claiming to be support.',
  },
];

export default function FaqScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <FontAwesome name="question-circle" size={22} color="#fff" style={{ marginBottom: 8 }} />
        <Text style={styles.heroTitle}>Frequently asked questions</Text>
        <Text style={styles.heroSub}>
          Quick answers about buying, selling, and using Mall263.
        </Text>
      </View>

      <View style={styles.card}>
        {FAQ.map((item, i) => (
          <View key={i} style={[styles.qRow, i < FAQ.length - 1 && styles.qRowBorder]}>
            <Text style={styles.q}>{item.q}</Text>
            <Text style={styles.a}>{item.a}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.supportBtn} onPress={() => router.push('/support')}>
        <FontAwesome name="life-ring" size={14} color="#fff" />
        <Text style={styles.supportBtnText}>Still stuck? Send a support request</Text>
      </Pressable>

      <Pressable style={styles.linkBtn} onPress={() => router.push('/help/terms')}>
        <Text style={styles.linkBtnText}>Terms of service</Text>
        <FontAwesome name="arrow-right" size={11} color={Brand.blue} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 40 },

  hero: {
    backgroundColor: Brand.blue,
    padding: 20,
    borderRadius: 18,
    marginBottom: 14,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { color: '#ffffffcc', fontSize: 13, marginTop: 4, lineHeight: 18 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  qRow: { padding: 16 },
  qRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.border },
  q: { fontSize: 14, fontWeight: '900', color: Brand.navy, lineHeight: 20 },
  a: { marginTop: 6, fontSize: 13, color: Brand.text, lineHeight: 19 },

  supportBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.blue,
    paddingVertical: 14,
    borderRadius: 12,
  },
  supportBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  linkBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  linkBtnText: { color: Brand.blue, fontSize: 13, fontWeight: '700' },
});
