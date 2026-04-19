import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { formatMoney } from '@/lib/products';
import { getApiBaseUrl } from '@/lib/config';

// React 19 class component type narrowing — expo-linear-gradient v55 ships a class
// component whose types don't satisfy React 19's stricter JSX component check.
const LG = LinearGradient as unknown as React.FC<LinearGradientProps>;

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#1B2A4A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 }
    : { elevation: 4 };

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

export default function PublicReceiptScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();

  const verifyQ = useQuery({
    queryKey: ['receipt-verify', saleId],
    queryFn: async () => {
      const res = await axios.get(`${getApiBaseUrl()}/api/v1/pos/receipts/verify/${saleId}`);
      return res.data as { authentic: boolean; receipt: any };
    },
    enabled: !!saleId,
    retry: 1,
  });

  if (verifyQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.loadingText}>Verifying receipt…</Text>
      </View>
    );
  }

  const authentic = verifyQ.data?.authentic ?? false;
  const sale = verifyQ.data?.receipt ?? null;
  const stallId = sale?.stall?.id ?? null;

  if (!authentic || !sale) {
    return (
      <View style={styles.centered}>
        <View style={styles.invalidIcon}>
          <FontAwesome name="times-circle" size={40} color={Brand.red} />
        </View>
        <Text style={styles.invalidTitle}>Receipt Not Found</Text>
        <Text style={styles.invalidSub}>This receipt could not be verified as authentic.</Text>
        <Pressable style={styles.homeBtn} onPress={() => router.replace('/')}>
          <Text style={styles.homeBtnText}>Go to Mall263</Text>
        </Pressable>
      </View>
    );
  }

  const items: any[] = sale.items ?? [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Verified badge */}
      <View style={styles.verifiedBadge}>
        <FontAwesome name="check-circle" size={20} color="#2E7D32" />
        <View style={{ flex: 1 }}>
          <Text style={styles.verifiedTitle}>Receipt Verified</Text>
          <Text style={styles.verifiedSub}>Authentic Mall263 receipt</Text>
        </View>
      </View>

      {/* Card */}
      <View style={[styles.card, cardShadow]}>

        {/* Orange→Blue accent bar */}
        <LG
          colors={['#F7941D', '#3B9AE1']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.accentBar}
        />

        {/* Store header */}
        <LG
          colors={['#1B2A4A', '#121d33']}
          style={styles.storeHeader}
        >
          <View style={styles.logoRing}>
            <Text style={styles.logoEmoji}>🏪</Text>
          </View>
          <Text style={styles.bizName}>
            {sale.stall?.merchant?.businessName ?? ''}
          </Text>
          <Text style={styles.storeName}>{sale.stall?.name}</Text>
          {sale.stall?.stallNumber ? (
            <Text style={styles.stallNum}>Stall #{sale.stall.stallNumber}</Text>
          ) : null}

          {stallId && (
            <Pressable
              style={styles.visitBtn}
              onPress={() => router.push(`/store/${stallId}` as any)}
            >
              <FontAwesome name="shopping-bag" size={11} color="#fff" />
              <Text style={styles.visitBtnText}>Visit Store</Text>
            </Pressable>
          )}
        </LG>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Receipt No.</Text>
            <Text style={[styles.metaVal, { color: Brand.blue }]}>{sale.receiptNumber}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>Date &amp; Time</Text>
            <Text style={styles.metaVal}>{fmtDate(sale.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.dashed} />

        {/* Items */}
        <View style={styles.itemsWrap}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.colHead, { flex: 1 }]}>Item</Text>
            <Text style={[styles.colHead, { width: 30, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.colHead, { width: 60, textAlign: 'right' }]}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.productName}</Text>
                {item.variantName && item.variantName !== 'Default' ? (
                  <Text style={styles.itemVariant}>{item.variantName}</Text>
                ) : null}
              </View>
              <Text style={[styles.itemQty, { width: 30, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[styles.itemTotal, { width: 60, textAlign: 'right' }]}>
                {formatMoney(item.totalPrice, 'USD')}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.dashed} />

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalVal}>{formatMoney(sale.subtotal, 'USD')}</Text>
          </View>
          {Number(sale.discountAmount) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalVal, { color: Brand.green }]}>
                −{formatMoney(sale.discountAmount, 'USD')}
              </Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandVal}>{formatMoney(sale.totalAmount, 'USD')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Payment</Text>
            <Text style={[styles.totalVal, { color: Brand.navy, fontWeight: '700' }]}>
              {String(sale.paymentMethod ?? '').replace(/_/g, ' ')}
            </Text>
          </View>
          {sale.deliveryAddress ? (
            <View style={[styles.totalRow, { marginTop: 6 }]}>
              <Text style={styles.totalLabel}>Deliver to</Text>
              <Text style={[styles.totalVal, { color: Brand.navy, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 8 }]}>
                {sale.deliveryAddress}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <LG colors={['#1B2A4A', '#121d33']} style={styles.footer}>
          <FontAwesome name="check-circle" size={32} color={Brand.green} style={{ marginBottom: 8 }} />
          <Text style={styles.footerThanks}>Thank you for your purchase!</Text>
          <Text style={styles.footerPowered}>Powered by Mall263</Text>
        </LG>
      </View>

      {/* CTA buttons */}
      {stallId && (
        <Pressable
          style={styles.stallBtn}
          onPress={() => router.push(`/store/${stallId}` as any)}
        >
          <FontAwesome name="shopping-bag" size={14} color="#fff" />
          <Text style={styles.stallBtnText}>Browse {sale.stall?.name ?? 'Store'}</Text>
        </Pressable>
      )}

      <Pressable style={styles.homeOutlineBtn} onPress={() => router.replace('/')}>
        <Text style={styles.homeOutlineBtnText}>Back to Mall263</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },

  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 14, padding: 32, backgroundColor: Brand.pageBg,
  },
  loadingText: { fontSize: 14, color: Brand.muted, marginTop: 8 },
  invalidIcon: { marginBottom: 4 },
  invalidTitle: { fontSize: 20, fontWeight: '900', color: Brand.navy, textAlign: 'center' },
  invalidSub: { fontSize: 13, color: Brand.muted, textAlign: 'center' },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  verifiedTitle: { fontSize: 13, fontWeight: '900', color: '#15803d' },
  verifiedSub: { fontSize: 11, color: '#16a34a', marginTop: 2 },

  card: { borderRadius: 22, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#dde3ee' },

  accentBar: { height: 5 },

  storeHeader: { paddingTop: 24, paddingBottom: 22, paddingHorizontal: 20, alignItems: 'center' },
  logoRing: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(247,148,29,0.5)',
  },
  logoEmoji: { fontSize: 30 },
  bizName: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  storeName: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stallNum: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 },
  visitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F7941D',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 14,
  },
  visitBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: '#fff',
  },
  metaLabel: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaVal: { fontSize: 13, fontWeight: '800', color: Brand.navy, marginTop: 3 },

  dashed: { height: 1.5, backgroundColor: '#dde3ee', marginHorizontal: 0 },

  itemsWrap: { backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 14 },
  itemsHeader: { flexDirection: 'row', marginBottom: 8 },
  colHead: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  itemName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  itemVariant: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  itemQty: { fontSize: 13, color: Brand.muted },
  itemTotal: { fontSize: 14, fontWeight: '900', color: Brand.navy },

  totalsWrap: { backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: 13, color: Brand.muted },
  totalVal: { fontSize: 13, color: Brand.muted },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    borderTopWidth: 1, borderColor: '#eef1f6', paddingTop: 10, marginTop: 4, marginBottom: 10,
  },
  grandLabel: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  grandVal: { fontSize: 24, fontWeight: '900', color: Brand.orange },

  footer: { paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center' },
  footerThanks: { color: '#fff', fontWeight: '900', fontSize: 14, marginBottom: 6 },
  footerPowered: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },

  stallBtn: {
    backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 10,
  },
  stallBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  homeBtn: {
    backgroundColor: Brand.blue, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center',
  },
  homeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  homeOutlineBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: Brand.border,
  },
  homeOutlineBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 14 },
});
