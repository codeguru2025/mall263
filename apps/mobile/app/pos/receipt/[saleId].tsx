import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { fetchSaleById } from '@/lib/pos-api';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

export default function ReceiptScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();

  const saleQ = useQuery({
    queryKey: ['pos-sale', saleId],
    queryFn: () => fetchSaleById(saleId!),
    enabled: !!saleId,
  });

  if (saleQ.isPending) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Brand.blue} /></View>;
  }

  if (saleQ.isError || !saleQ.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load receipt.</Text>
        <Pressable style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const sale = saleQ.data;
  const items = sale.items ?? [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Receipt header */}
      <View style={[styles.receiptCard, cardShadow]}>
        <Text style={styles.successMark}>✓</Text>
        <Text style={styles.receiptTitle}>Sale Complete</Text>
        <Text style={styles.receiptNumber}>#{sale.receiptNumber ?? sale.id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.receiptDate}>{fmtDate(sale.createdAt)}</Text>

        {/* Items */}
        <View style={styles.divider} />
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemMeta}>{item.variantName} × {item.quantity}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatMoney(item.totalPrice, 'USD')}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.divider} />
        {Number(sale.discountAmount) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={styles.totalValue}>−{formatMoney(sale.discountAmount, 'USD')}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.totalRowFinal]}>
          <Text style={styles.totalLabelFinal}>Total</Text>
          <Text style={styles.totalValueFinal}>{formatMoney(sale.totalAmount, 'USD')}</Text>
        </View>

        {/* Payment & status */}
        <View style={styles.divider} />
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Payment</Text>
            <Text style={styles.metaValue}>{sale.paymentMethod}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={[styles.metaValue, styles.statusComplete]}>{sale.status}</Text>
          </View>
          {sale.customerPhone && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Customer</Text>
              <Text style={styles.metaValue}>{sale.customerPhone}</Text>
            </View>
          )}
          {sale.deliveryAddress && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Delivery</Text>
              <Text style={styles.metaValue}>{sale.deliveryAddress}</Text>
            </View>
          )}
          {sale.cashier && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Cashier</Text>
              <Text style={styles.metaValue}>{sale.cashier.firstName} {sale.cashier.lastName}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <Pressable
        style={styles.newSaleBtn}
        onPress={() => router.back()}
      >
        <Text style={styles.newSaleBtnText}>New sale</Text>
      </Pressable>

      <Pressable style={styles.hubBtn} onPress={() => router.push('/pos')}>
        <Text style={styles.hubBtnText}>Back to POS Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  errorText: { fontSize: 15, fontWeight: '700', color: Brand.red, marginBottom: 12 },

  receiptCard: {
    backgroundColor: Brand.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 14,
  },
  successMark: { fontSize: 40, textAlign: 'center', color: Brand.green },
  receiptTitle: { fontSize: 22, fontWeight: '900', color: Brand.navy, textAlign: 'center', marginTop: 4 },
  receiptNumber: {
    fontSize: 13, fontWeight: '700', color: Brand.muted, textAlign: 'center', marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  receiptDate: { fontSize: 12, color: Brand.muted, textAlign: 'center', marginTop: 2 },

  divider: { height: 1, backgroundColor: Brand.border, marginVertical: 12 },

  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  itemMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '900', color: Brand.navy, minWidth: 70, textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalRowFinal: { marginTop: 6 },
  totalLabel: { fontSize: 13, color: Brand.muted },
  totalValue: { fontSize: 13, color: Brand.muted },
  totalLabelFinal: { fontSize: 17, fontWeight: '900', color: Brand.navy },
  totalValueFinal: { fontSize: 20, fontWeight: '900', color: Brand.navy },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metaItem: { minWidth: '40%' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: '800', color: Brand.navy, marginTop: 2 },
  statusComplete: { color: Brand.green },

  newSaleBtn: { backgroundColor: Brand.green, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  newSaleBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  doneBtn: { backgroundColor: Brand.blue, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  doneBtnText: { color: '#fff', fontWeight: '800' },
  hubBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Brand.border },
  hubBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 14 },
});
