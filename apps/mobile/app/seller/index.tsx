import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant, fetchProductsByStall, type Product } from '@/lib/seller-api';
import { fetchPaymentConfig, savePaymentConfig } from '@/lib/merchant-pay-api';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

export default function SellerHubScreen() {
  const [stallIndex, setStallIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [ecocashCode, setEcocashCode] = useState('');
  const [onemoneyCode, setOnemoneyCode] = useState('');
  const [savingCodes, setSavingCodes] = useState(false);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });

  const merchantId = meQ.data?.merchant?.id;
  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  const stall = stallsQ.data?.[stallIndex];

  const payConfigQ = useQuery({
    queryKey: ['stall-pay-config', stall?.id],
    queryFn: () => fetchPaymentConfig(stall!.id),
    enabled: !!stall?.id,
  });

  // Sync form when config loads or stall changes
  useEffect(() => {
    if (payConfigQ.data) {
      setEcocashCode(payConfigQ.data.ecocashMerchantCode ?? '');
      setOnemoneyCode(payConfigQ.data.onemoneyMerchantCode ?? '');
    }
  }, [payConfigQ.data]);

  const handleSaveCodes = async () => {
    if (!stall) return;
    const eco = ecocashCode.trim();
    const one = onemoneyCode.trim();
    if (eco && !/^\d{4,10}$/.test(eco)) {
      Alert.alert('Invalid code', 'EcoCash merchant code must be 4-10 digits'); return;
    }
    if (one && !/^\d{4,10}$/.test(one)) {
      Alert.alert('Invalid code', 'OneMoney merchant code must be 4-10 digits'); return;
    }
    setSavingCodes(true);
    try {
      await savePaymentConfig(stall.id, {
        ecocashMerchantCode: eco || null,
        onemoneyMerchantCode: one || null,
      });
      await payConfigQ.refetch();
      Alert.alert('Saved', 'Payment codes updated. Customers can now pay directly to your merchant account.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save codes.');
    } finally {
      setSavingCodes(false);
    }
  };

  const productsQ = useQuery({
    queryKey: ['stall-products', stall?.id],
    queryFn: () => fetchProductsByStall(stall!.id),
    enabled: !!stall?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([meQ.refetch(), stallsQ.refetch(), productsQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [meQ, stallsQ, productsQ]);

  if (meQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  if (!merchantId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>You haven&apos;t set up your stall yet.</Text>
        <Text style={styles.mutedText}>
          Tell us about your business and create your first storefront — takes about a minute.
        </Text>
        <Pressable
          style={({ pressed }: { pressed: boolean }) => [styles.setupBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/seller/setup')}
        >
          <Text style={styles.setupBtnText}>Set up my stall</Text>
        </Pressable>
      </View>
    );
  }

  const stalls = stallsQ.data ?? [];
  const products = productsQ.data?.data ?? [];

  const renderProduct = ({ item }: { item: Product }) => {
    const thumb = item.images?.find((i) => i.isPrimary)?.url ?? item.images?.[0]?.url;
    const minPrice = item.variants?.reduce(
      (min, v) => Math.min(min, Number(v.sellingPrice)),
      Infinity,
    ) ?? Infinity;
    const totalStock = item.variants?.reduce(
      (sum, v) => sum + (v.inventory?.quantity ?? 0),
      0,
    );

    return (
      <Pressable
        style={[styles.productRow, cardShadow]}
        onPress={() => router.push({ pathname: '/seller/product/[id]', params: { id: item.id, stallId: stall!.id } })}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.productThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.productThumb, styles.noThumb]}>
            <Text style={styles.noThumbText}>IMG</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productMeta}>
            {isFinite(minPrice) ? `From ${formatMoney(minPrice, 'USD')}` : '—'}
            {' · '}
            <Text style={[styles.statusBadge, item.status === 'ACTIVE' ? styles.statusActive : styles.statusDraft]}>
              {item.status}
            </Text>
          </Text>
          <Text style={styles.stockText}>Stock: {totalStock ?? '—'}</Text>
        </View>
      </Pressable>
    );
  };

  const listHeader = (
    <View>
      {/* Stall header */}
      <View style={[styles.stallCard, cardShadow]}>
        <Text style={styles.stallName}>{stall?.name ?? '—'}</Text>
        {stall?.stallNumber && <Text style={styles.stallSub}>Stall #{stall.stallNumber}</Text>}
        <Text style={styles.stallSub}>{meQ.data?.merchant?.businessName}</Text>

        {/* Stall picker if multiple stalls */}
        {stalls.length > 1 && (
          <View style={styles.stallPicker}>
            {stalls.map((s, i) => (
              <Pressable
                key={s.id}
                style={[styles.stallPickerBtn, stallIndex === i && styles.stallPickerBtnActive]}
                onPress={() => setStallIndex(i)}
              >
                <Text style={[styles.stallPickerText, stallIndex === i && styles.stallPickerTextActive]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Quick ops links */}
      <View style={styles.opsRow}>
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/sales')}>
          <Text style={styles.opsCardIcon}>💰</Text>
          <Text style={styles.opsCardText}>Sales</Text>
        </Pressable>
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/expenses')}>
          <Text style={styles.opsCardIcon}>🧾</Text>
          <Text style={styles.opsCardText}>Expenses</Text>
        </Pressable>
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/reports')}>
          <Text style={styles.opsCardIcon}>📊</Text>
          <Text style={styles.opsCardText}>Reports</Text>
        </Pressable>
      </View>
      <View style={styles.opsRow}>
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/attendants' as any)}>
          <Text style={styles.opsCardIcon}>👥</Text>
          <Text style={styles.opsCardText}>Attendants</Text>
        </Pressable>
        {stall && (
          <Pressable style={styles.opsCard} onPress={() => router.push({ pathname: '/store/[stallId]', params: { stallId: stall.id } })}>
            <Text style={styles.opsCardIcon}>🏪</Text>
            <Text style={styles.opsCardText}>My stall page</Text>
          </Pressable>
        )}
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/qr' as any)}>
          <Text style={styles.opsCardIcon}>📱</Text>
          <Text style={styles.opsCardText}>Shop QR</Text>
        </Pressable>
        <Pressable style={styles.opsCard} onPress={() => router.push('/subscriptions' as any)}>
          <Text style={styles.opsCardIcon}>⭐</Text>
          <Text style={styles.opsCardText}>Subscription</Text>
        </Pressable>
      </View>

      {/* Merchant payment codes */}
      <View style={[styles.payCard, cardShadow]}>
        <View style={styles.payCardHeader}>
          <FontAwesome name="mobile" size={16} color={Brand.blue} />
          <Text style={styles.payCardTitle}>Merchant Payment Codes</Text>
        </View>
        <Text style={styles.payCardHint}>
          When configured, customers pay directly into your EcoCash or OneMoney merchant account via USSD push — no Manual PIN entry required from you.
        </Text>

        <Text style={styles.payFieldLabel}>EcoCash Merchant Code</Text>
        <View style={styles.payFieldRow}>
          <TextInput
            style={styles.payInput}
            value={ecocashCode}
            onChangeText={setEcocashCode}
            placeholder="e.g. 123456"
            placeholderTextColor={Brand.muted}
            keyboardType="number-pad"
            maxLength={10}
          />
          {!!payConfigQ.data?.ecocashMerchantCode && (
            <View style={styles.configuredBadge}>
              <FontAwesome name="check-circle" size={13} color="#43A047" />
              <Text style={styles.configuredText}>Active</Text>
            </View>
          )}
        </View>

        <Text style={styles.payFieldLabel}>OneMoney Merchant Code</Text>
        <View style={styles.payFieldRow}>
          <TextInput
            style={styles.payInput}
            value={onemoneyCode}
            onChangeText={setOnemoneyCode}
            placeholder="e.g. 654321"
            placeholderTextColor={Brand.muted}
            keyboardType="number-pad"
            maxLength={10}
          />
          {!!payConfigQ.data?.onemoneyMerchantCode && (
            <View style={styles.configuredBadge}>
              <FontAwesome name="check-circle" size={13} color="#43A047" />
              <Text style={styles.configuredText}>Active</Text>
            </View>
          )}
        </View>

        <Pressable
          style={[styles.saveCodesBtn, savingCodes && styles.btnDisabled]}
          onPress={handleSaveCodes}
          disabled={savingCodes}
        >
          {savingCodes ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveCodesBtnText}>Save payment codes</Text>
          )}
        </Pressable>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Products ({productsQ.data?.total ?? products.length})
        </Text>
        {stall && (
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/seller/product/new', params: { stallId: stall.id } })}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (stallsQ.isPending || productsQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderProduct}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No products yet.</Text>
          {stall && (
            <Pressable
              style={styles.addBtnLarge}
              onPress={() => router.push({ pathname: '/seller/product/new', params: { stallId: stall.id } })}
            >
              <Text style={styles.addBtnText}>Add your first product</Text>
            </Pressable>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 40, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },

  stallCard: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  stallName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  stallSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  stallPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stallPickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  stallPickerBtnActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  stallPickerText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  stallPickerTextActive: { color: '#fff' },

  opsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  opsCard: {
    flex: 1,
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  opsCardIcon: { fontSize: 22 },
  opsCardText: { fontSize: 12, fontWeight: '800', color: Brand.navy },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  addBtn: { backgroundColor: Brand.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnLarge: { marginTop: 12, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  productRow: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  productThumb: { width: 72, height: 72 },
  noThumb: { backgroundColor: Brand.border, justifyContent: 'center', alignItems: 'center' },
  noThumbText: { fontSize: 10, color: Brand.muted, fontWeight: '700' },
  productInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  productName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  productMeta: { fontSize: 12, color: Brand.muted, marginTop: 3 },
  stockText: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  statusBadge: { fontSize: 11, fontWeight: '800' },
  statusActive: { color: Brand.green },
  statusDraft: { color: Brand.orange },

  empty: { alignItems: 'center', paddingTop: 32 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.navy, textAlign: 'center' },
  mutedText: { fontSize: 13, color: Brand.muted, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  setupBtn: {
    marginTop: 10,
    backgroundColor: Brand.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  setupBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  payCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 16,
  },
  payCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  payCardTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy },
  payCardHint: { fontSize: 12, color: Brand.muted, lineHeight: 17, marginBottom: 14 },
  payFieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  payFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  payInput: {
    flex: 1,
    backgroundColor: Brand.pageBg,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: Brand.navy,
    letterSpacing: 1,
  },
  configuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  configuredText: { fontSize: 11, fontWeight: '800', color: '#43A047' },
  saveCodesBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveCodesBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
});
