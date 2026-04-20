import { useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import QRCode from 'react-native-qrcode-svg';
import { Brand } from '@/constants/brand';
import { fetchSaleById } from '@/lib/pos-api';
import { formatMoney } from '@/lib/products';
import { getApiBaseUrl } from '@/lib/config';

// react-native-qrcode-svg ships a class component incompatible with React 19 strict JSX
const QR = QRCode as unknown as React.FC<{
  value: string; size?: number; color?: string; backgroundColor?: string; quietZone?: number;
}>;

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 12 }
    : { elevation: 3 };

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

function receiptPublicUrl(saleId: string): string {
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}/receipts/${saleId}`;
}

export default function ReceiptScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();

  const saleQ = useQuery({
    queryKey: ['pos-sale', saleId],
    queryFn: () => fetchSaleById(saleId!),
    enabled: !!saleId,
  });

  const receiptUrl = saleId ? receiptPublicUrl(saleId) : '';

  const buildShareMessage = useCallback(() => {
    const sale = saleQ.data;
    if (!sale) return '';
    const shop = sale.stall?.name ?? 'Mall263';
    const num = sale.receiptNumber ?? saleId?.slice(0, 8).toUpperCase() ?? '';
    return `🧾 Receipt #${num} — ${shop}\nTotal: ${formatMoney(sale.totalAmount, 'USD')}\nVerify: ${receiptUrl}`;
  }, [saleQ.data, receiptUrl, saleId]);

  const handleWhatsApp = useCallback(async () => {
    const sale = saleQ.data;
    if (!sale?.customerPhone) return;
    const phone = sale.customerPhone.replace(/[^0-9]/g, '');
    const msg = buildShareMessage();
    const waUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    const canOpen = await Linking.canOpenURL(waUrl);
    if (canOpen) {
      await Linking.openURL(waUrl);
    } else {
      // WhatsApp not installed — fall back to native share
      try { await Share.share({ message: msg, url: receiptUrl }); } catch { /* cancelled */ }
    }
  }, [saleQ.data, buildShareMessage, receiptUrl]);

  const handleShare = useCallback(async () => {
    const msg = buildShareMessage();
    try { await Share.share({ message: msg, url: receiptUrl }); } catch { /* cancelled */ }
  }, [buildShareMessage, receiptUrl]);

  if (saleQ.isPending) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Brand.blue} /></View>;
  }

  if (saleQ.isError || !saleQ.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load receipt.</Text>
        <Pressable style={styles.outlineBtn} onPress={() => router.back()}>
          <Text style={styles.outlineBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const sale = saleQ.data;
  const items = sale.items ?? [];
  const cashierName = sale.cashier ? `${sale.cashier.firstName} ${sale.cashier.lastName}` : null;
  const hasCustomerPhone = !!sale.customerPhone;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Success banner */}
      <View style={styles.successBanner}>
        <FontAwesome name="check-circle" size={20} color="#15803d" />
        <Text style={styles.successText}>Sale Complete</Text>
      </View>

      {/* Receipt card */}
      <View style={[styles.card, cardShadow]}>

        {/* Store header */}
        <View style={styles.storeHeader}>
          <View style={styles.storeIcon}>
            <Text style={{ fontSize: 26 }}>🏪</Text>
          </View>
          {sale.stall?.merchant?.businessName ? (
            <Text style={styles.bizName}>{sale.stall.merchant.businessName}</Text>
          ) : null}
          <Text style={styles.storeName}>{sale.stall?.name ?? 'Receipt'}</Text>
          {sale.stall?.stallNumber ? (
            <Text style={styles.stallNum}>Stall #{sale.stall.stallNumber}</Text>
          ) : null}
        </View>

        {/* Receipt number & date */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Receipt No.</Text>
            <Text style={styles.metaValue}>#{sale.receiptNumber ?? sale.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>Date &amp; Time</Text>
            <Text style={styles.metaValue}>{fmtDate(sale.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Items */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.colHead, { flex: 1 }]}>Item</Text>
          <Text style={[styles.colHead, { width: 28, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.colHead, { width: 64, textAlign: 'right' }]}>Total</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.productName}</Text>
              {item.variantName && item.variantName !== 'Default' ? (
                <Text style={styles.itemVariant}>{item.variantName}</Text>
              ) : null}
            </View>
            <Text style={[styles.itemQty, { width: 28, textAlign: 'center' }]}>{item.quantity}</Text>
            <Text style={[styles.itemTotal, { width: 64, textAlign: 'right' }]}>
              {formatMoney(item.totalPrice, 'USD')}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />

        {/* Totals */}
        {Number(sale.discountAmount) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={[styles.totalValue, { color: Brand.green }]}>
              −{formatMoney(sale.discountAmount, 'USD')}
            </Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{formatMoney(sale.totalAmount, 'USD')}</Text>
        </View>

        <View style={styles.divider} />

        {/* Payment info grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.metaLabel}>Payment</Text>
            <Text style={styles.infoValue}>{String(sale.paymentMethod).replace(/_/g, ' ')}</Text>
          </View>
          {cashierName ? (
            <View style={styles.infoItem}>
              <Text style={styles.metaLabel}>Cashier / DHP</Text>
              <Text style={styles.infoValue}>{cashierName}</Text>
            </View>
          ) : null}
          {sale.customerPhone ? (
            <View style={styles.infoItem}>
              <Text style={styles.metaLabel}>Customer</Text>
              <Text style={styles.infoValue}>{sale.customerPhone}</Text>
            </View>
          ) : null}
          {sale.deliveryAddress ? (
            <View style={[styles.infoItem, { minWidth: '100%' }]}>
              <Text style={styles.metaLabel}>Deliver to</Text>
              <Text style={styles.infoValue}>{sale.deliveryAddress}</Text>
            </View>
          ) : null}
        </View>

        {/* QR code for receipt verification */}
        {receiptUrl ? (
          <>
            <View style={styles.divider} />
            <View style={styles.qrSection}>
              <View style={styles.qrBox}>
                <QR value={receiptUrl} size={88} color="#0f172a" backgroundColor="#fff" quietZone={6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrTitle}>Digital Receipt</Text>
                <Text style={styles.qrSub}>Customer scans to verify this receipt online</Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {/* Share actions */}
      <View style={styles.shareRow}>
        {hasCustomerPhone ? (
          <Pressable style={[styles.shareBtn, styles.whatsappBtn]} onPress={handleWhatsApp}>
            <FontAwesome name="whatsapp" size={18} color="#fff" />
            <Text style={styles.whatsappText}>Send to Customer</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.shareBtn, styles.nativeShareBtn, !hasCustomerPhone && { flex: 1 }]}
          onPress={handleShare}
        >
          <FontAwesome name="share-alt" size={15} color={Brand.navy} />
          <Text style={styles.nativeShareText}>Share</Text>
        </Pressable>
      </View>

      {/* Navigation actions */}
      <Pressable style={styles.newSaleBtn} onPress={() => router.back()}>
        <Text style={styles.newSaleBtnText}>New Sale</Text>
      </Pressable>
      <Pressable style={styles.outlineBtn} onPress={() => router.push('/pos')}>
        <Text style={styles.outlineBtnText}>Back to POS Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg, gap: 12 },
  errorText: { fontSize: 15, fontWeight: '700', color: Brand.red },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  successText: { fontSize: 15, fontWeight: '900', color: '#15803d' },

  card: {
    backgroundColor: '#fff', borderRadius: 20,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 12, overflow: 'hidden',
  },

  storeHeader: {
    backgroundColor: Brand.blue, paddingTop: 22, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center',
  },
  storeIcon: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(247,148,29,0.5)',
  },
  bizName: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  storeName: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stallNum: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
  },
  metaLabel: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 13, fontWeight: '800', color: Brand.navy, marginTop: 3 },

  divider: { height: 1, backgroundColor: Brand.border, marginHorizontal: 0 },

  itemsHeader: { flexDirection: 'row', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  colHead: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingBottom: 10 },
  itemName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  itemVariant: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  itemQty: { fontSize: 13, color: Brand.muted, paddingTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '900', color: Brand.navy },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 6 },
  totalLabel: { fontSize: 13, color: Brand.muted },
  totalValue: { fontSize: 13, color: Brand.muted },
  grandRow: {
    borderTopWidth: 1, borderTopColor: Brand.border,
    paddingTop: 12, marginTop: 4, marginBottom: 12, alignItems: 'baseline',
  },
  grandLabel: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  grandValue: { fontSize: 22, fontWeight: '900', color: Brand.navy },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  infoItem: { minWidth: '40%' },
  infoValue: { fontSize: 14, fontWeight: '700', color: Brand.navy, marginTop: 3 },

  qrSection: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  qrBox: { padding: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: Brand.border },
  qrTitle: { fontSize: 13, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  qrSub: { fontSize: 11, color: Brand.muted, lineHeight: 16 },

  shareRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14,
  },
  whatsappBtn: { backgroundColor: '#25D366' },
  whatsappText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  nativeShareBtn: {
    flex: 0, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.card,
  },
  nativeShareText: { color: Brand.navy, fontWeight: '800', fontSize: 14 },

  newSaleBtn: {
    backgroundColor: Brand.green, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginBottom: 10,
  },
  newSaleBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  outlineBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: Brand.border,
  },
  outlineBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 14 },
});
