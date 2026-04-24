import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import QRCode from 'react-native-qrcode-svg';
import { Brand } from '@/constants/brand';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant, fetchProductsByStall, type Product } from '@/lib/seller-api';
import { fetchPaymentConfig, savePaymentConfig } from '@/lib/merchant-pay-api';
import { formatMoney } from '@/lib/products';
import { getApiBaseUrl } from '@/lib/config';
import { api } from '@/lib/api';

// react-native-qrcode-svg ships a class component incompatible with React 19 strict JSX
const QR = QRCode as unknown as React.FC<{
  value: string; size?: number; color?: string; backgroundColor?: string; quietZone?: number;
}>;

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

function stallWebUrl(stallId: string): string {
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}/store/${stallId}`;
}

export default function SellerHubScreen() {
  const insets = useSafeAreaInsets();
  const [stallIndex, setStallIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [ecocashCode, setEcocashCode] = useState('');
  const [onemoneyCode, setOnemoneyCode] = useState('');
  const [savingCodes, setSavingCodes] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });

  const subStatusQ = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/subscriptions/status');
      return data as { fullyAccess: boolean; status: string };
    },
    staleTime: 60_000,
  });
  // Fail closed on load or error to avoid briefly unlocking POS/Reports for an
  // unsubscribed account while the request is in flight.
  const sellerHasAccess = subStatusQ.isSuccess ? (subStatusQ.data?.fullyAccess ?? false) : false;

  const merchantId = meQ.data?.merchant?.id;
  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  const stalls = stallsQ.data ?? [];
  const stall = stalls[stallIndex] ?? undefined;

  const payConfigQ = useQuery({
    queryKey: ['stall-pay-config', stall?.id],
    queryFn: () => fetchPaymentConfig(stall!.id),
    enabled: !!stall?.id,
  });

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
      Alert.alert('Saved', 'Payment codes updated.');
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

  const shopUrl = stall ? stallWebUrl(stall.id) : '';

  const handleShareQr = useCallback(async () => {
    if (!shopUrl || !stall) return;
    try {
      await Share.share({
        message: `Visit ${stall.name} on Mall263: ${shopUrl}`,
        url: shopUrl,
      });
    } catch { /* cancelled */ }
  }, [shopUrl, stall]);

  // Must run every render, before any early return — not after `meQ.isPending` / `!merchantId` branches.
  const allProducts = productsQ.data?.data ?? [];
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;
    const q = productSearch.toLowerCase();
    return allProducts.filter(
      (p) => (p.name ?? '').toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q),
    );
  }, [allProducts, productSearch]);

  if (meQ.isPending) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Brand.blue} /></View>;
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

  const renderProduct = ({ item }: { item: Product }) => {
    if (!stall) return null;
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
        onPress={() => router.push({ pathname: '/seller/product/[id]', params: { id: item.id, stallId: stall.id } })}
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
            {'  '}
            <Text style={[styles.statusBadge, item.status === 'ACTIVE' ? styles.statusActive : styles.statusDraft]}>
              {item.status}
            </Text>
          </Text>
          <Text style={styles.stockText}>Stock: {totalStock ?? '—'}</Text>
        </View>
        <View style={styles.editHint}>
          <FontAwesome name="chevron-right" size={12} color={Brand.muted} />
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

      {/* Subscription gate banner */}
      {!sellerHasAccess && (
        <View style={styles.subGateBanner}>
          <FontAwesome name="lock" size={16} color={Brand.orange} />
          <View style={{ flex: 1 }}>
            <Text style={styles.subGateTitle}>Trial ended — Subscribe for $5/month</Text>
            <Text style={styles.subGateBody}>POS, reports, and demand bidding require an active subscription.</Text>
          </View>
          <Pressable
            style={styles.subGateBtn}
            onPress={() => router.push('/subscriptions' as never)}
          >
            <Text style={styles.subGateBtnText}>Subscribe →</Text>
          </Pressable>
        </View>
      )}

      {/* Sell Now — primary CTA */}
      {stall && (
        <Pressable
          style={[styles.sellNowBtn, !sellerHasAccess && styles.sellNowBtnLocked]}
          onPress={() => {
            if (!sellerHasAccess) {
              Alert.alert('Subscription required', 'Subscribe for $5/month to access the POS register.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Subscribe', onPress: () => router.push('/subscriptions' as never) },
              ]);
              return;
            }
            router.push({ pathname: '/pos/cart', params: { stallId: stall.id, stallName: stall.name } });
          }}
        >
          <FontAwesome name={sellerHasAccess ? 'shopping-cart' : 'lock'} size={18} color="#fff" />
          <Text style={styles.sellNowText}>
            {sellerHasAccess ? 'Sell Now — Open POS Register' : 'POS (Subscription Required)'}
          </Text>
        </Pressable>
      )}

      {/* Quick ops */}
      <View style={styles.opsRow}>
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/sales')}>
          <Text style={styles.opsCardIcon}>💰</Text>
          <Text style={styles.opsCardText}>Sales</Text>
        </Pressable>
        <Pressable style={styles.opsCard} onPress={() => router.push('/seller/expenses')}>
          <Text style={styles.opsCardIcon}>🧾</Text>
          <Text style={styles.opsCardText}>Expenses</Text>
        </Pressable>
        <Pressable
          style={[styles.opsCard, !sellerHasAccess && styles.opsCardLocked]}
          onPress={() => {
            if (!sellerHasAccess) {
              Alert.alert('Subscription required', 'Subscribe for $5/month to access reports.');
              return;
            }
            router.push('/seller/reports');
          }}
        >
          <Text style={styles.opsCardIcon}>{sellerHasAccess ? '📊' : '🔒'}</Text>
          <Text style={[styles.opsCardText, !sellerHasAccess && { color: Brand.muted }]}>Reports</Text>
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
            <Text style={styles.opsCardText}>My Stall</Text>
          </Pressable>
        )}
        <Pressable style={styles.opsCard} onPress={() => router.push('/subscriptions' as any)}>
          <Text style={styles.opsCardIcon}>⭐</Text>
          <Text style={styles.opsCardText}>Subscription</Text>
        </Pressable>
      </View>
      <View style={styles.opsRow}>
        {stall && (
          <Pressable style={styles.opsCard} onPress={() => router.push({ pathname: '/seller/virtual-walk', params: { stallId: stall.id } } as any)}>
            <Text style={styles.opsCardIcon}>🎥</Text>
            <Text style={styles.opsCardText}>Virtual Walk</Text>
          </Pressable>
        )}
        {stall && (
          <Pressable style={styles.opsCard} onPress={() => router.push({ pathname: '/seller/discounts', params: { stallId: stall.id } } as any)}>
            <Text style={styles.opsCardIcon}>🏷️</Text>
            <Text style={styles.opsCardText}>Discounts</Text>
          </Pressable>
        )}
        {stall && (
          <Pressable style={styles.opsCard} onPress={() => router.push({ pathname: '/seller/inventory', params: { stallId: stall.id } } as any)}>
            <Text style={styles.opsCardIcon}>📦</Text>
            <Text style={styles.opsCardText}>Inventory</Text>
          </Pressable>
        )}
      </View>

      {/* Boost actions */}
      {stall && (
        <View style={[styles.boostCard, cardShadow]}>
          <Text style={styles.boostTitle}>
            <FontAwesome name="bolt" size={14} color={Brand.orange} /> Boost
          </Text>
          <Text style={styles.boostHint}>Increase visibility of your stall or products in search results.</Text>
          <View style={styles.boostRow}>
            <Pressable
              style={styles.boostBtn}
              onPress={() => {
                Alert.alert(
                  'Boost Stall',
                  `Boost "${stall.name}" to appear at the top of search results?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Boost',
                      onPress: async () => {
                        try {
                          const { api } = await import('@/lib/api');
                          await api.post(`/api/v1/stalls/${stall.id}/boost`);
                          Alert.alert('Boosted!', 'Your stall is now boosted in search results.');
                        } catch (e: any) {
                          Alert.alert('Error', e?.response?.data?.message ?? 'Could not boost stall.');
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <FontAwesome name="rocket" size={13} color="#fff" />
              <Text style={styles.boostBtnText}>Boost Stall</Text>
            </Pressable>
            <Pressable
              style={[styles.boostBtn, styles.boostBtnOutline]}
              onPress={() => Alert.alert(
                'Boost a Product',
                'Select a product from the list below to boost it.',
              )}
            >
              <FontAwesome name="star" size={13} color={Brand.orange} />
              <Text style={[styles.boostBtnText, { color: Brand.orange }]}>Boost Product</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Shop QR — embedded inline */}
      {shopUrl ? (
        <View style={[styles.qrCard, cardShadow]}>
          <View style={styles.qrBox}>
            <QR value={shopUrl} size={90} color="#0f172a" backgroundColor="#fff" quietZone={8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.qrTitle}>Shop QR Code</Text>
            <Text style={styles.qrSub}>Customers scan to visit your shop page</Text>
            <Pressable style={styles.qrShareBtn} onPress={handleShareQr}>
              <FontAwesome name="share-alt" size={13} color="#fff" />
              <Text style={styles.qrShareText}>Share link</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Merchant payment codes — editable by STALL_OWNER only */}
      {meQ.data?.role === 'STALL_OWNER' ? (
        <View style={[styles.payCard, cardShadow]}>
          <View style={styles.payCardHeader}>
            <FontAwesome name="mobile" size={16} color={Brand.blue} />
            <Text style={styles.payCardTitle}>Merchant Payment Codes</Text>
          </View>
          <Text style={styles.payCardHint}>
            Configure EcoCash or OneMoney merchant codes so customers can pay via USSD push.
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
      ) : (
        /* Attendants see active status only — no inputs, no save */
        <View style={[styles.payCard, cardShadow]}>
          <View style={styles.payCardHeader}>
            <FontAwesome name="mobile" size={16} color={Brand.blue} />
            <Text style={styles.payCardTitle}>Merchant Payment Codes</Text>
          </View>
          <View style={styles.payReadRow}>
            <Text style={styles.payReadLabel}>EcoCash</Text>
            {payConfigQ.data?.ecocashMerchantCode ? (
              <View style={styles.configuredBadge}>
                <FontAwesome name="check-circle" size={13} color="#43A047" />
                <Text style={styles.configuredText}>Active</Text>
              </View>
            ) : (
              <Text style={styles.payReadNone}>Not configured</Text>
            )}
          </View>
          <View style={styles.payReadRow}>
            <Text style={styles.payReadLabel}>OneMoney</Text>
            {payConfigQ.data?.onemoneyMerchantCode ? (
              <View style={styles.configuredBadge}>
                <FontAwesome name="check-circle" size={13} color="#43A047" />
                <Text style={styles.configuredText}>Active</Text>
              </View>
            ) : (
              <Text style={styles.payReadNone}>Not configured</Text>
            )}
          </View>
        </View>
      )}

      {/* Products section header with search */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Products ({productsQ.data?.total ?? allProducts.length})
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
      <TextInput
        style={styles.searchInput}
        value={productSearch}
        onChangeText={setProductSearch}
        placeholder="Search products…"
        placeholderTextColor={Brand.muted}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
    </View>
  );

  if (stallsQ.isPending || productsQ.isPending) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Brand.blue} /></View>;
  }

  return (
    <FlatList
      data={filteredProducts}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderProduct}
      ListHeaderComponent={listHeader}
      contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{productSearch ? 'No products match your search.' : 'No products yet.'}</Text>
          {!productSearch && stall && (
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

  stallCard: { backgroundColor: Brand.blue, borderRadius: 16, padding: 18, marginBottom: 14 },
  stallName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  stallSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  stallPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stallPickerBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  stallPickerBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: '#fff' },
  stallPickerText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' },
  stallPickerTextActive: { color: '#fff' },

  subGateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff7ed', borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1.5, borderColor: Brand.orange + '88',
  },
  subGateTitle: { fontSize: 12, fontWeight: '900', color: Brand.navy },
  subGateBody: { fontSize: 11, color: Brand.muted, lineHeight: 16, marginTop: 2 },
  subGateBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Brand.orange, borderRadius: 10 },
  subGateBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  sellNowBtn: {
    backgroundColor: Brand.green, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 14,
  },
  sellNowBtnLocked: { backgroundColor: Brand.muted },
  sellNowText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  opsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  opsCard: {
    flex: 1, backgroundColor: Brand.card, borderRadius: 14,
    borderWidth: 1, borderColor: Brand.border, alignItems: 'center', paddingVertical: 14, gap: 5,
  },
  opsCardLocked: { backgroundColor: '#f8f8f8', borderStyle: 'dashed', opacity: 0.7 },
  opsCardIcon: { fontSize: 22 },
  opsCardText: { fontSize: 11, fontWeight: '800', color: Brand.navy, textAlign: 'center' },

  qrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 14,
  },
  qrBox: { padding: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: Brand.border },
  qrTitle: { fontSize: 14, fontWeight: '900', color: Brand.navy, marginBottom: 3 },
  qrSub: { fontSize: 11, color: Brand.muted, lineHeight: 15, marginBottom: 10 },
  qrShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Brand.blue, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  qrShareText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  addBtn: { backgroundColor: Brand.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnLarge: { marginTop: 12, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  searchInput: {
    backgroundColor: Brand.card, borderWidth: 1.5, borderColor: Brand.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: Brand.text, marginBottom: 12,
  },

  productRow: {
    flexDirection: 'row', backgroundColor: Brand.card, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: Brand.border, overflow: 'hidden', alignItems: 'center',
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
  editHint: { paddingRight: 14 },

  empty: { alignItems: 'center', paddingTop: 32 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.navy, textAlign: 'center' },
  mutedText: { fontSize: 13, color: Brand.muted, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  setupBtn: { marginTop: 10, backgroundColor: Brand.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  setupBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  payCard: {
    backgroundColor: Brand.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 16,
  },
  payCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  payCardTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy },
  payCardHint: { fontSize: 12, color: Brand.muted, lineHeight: 17, marginBottom: 14 },
  payFieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  payFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  payInput: {
    flex: 1, backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, fontWeight: '700', color: Brand.navy, letterSpacing: 1,
  },
  configuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  configuredText: { fontSize: 11, fontWeight: '800', color: '#43A047' },
  payReadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.border },
  payReadLabel: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  payReadNone: { fontSize: 12, color: Brand.muted },
  saveCodesBtn: { backgroundColor: Brand.blue, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveCodesBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },

  boostCard: {
    backgroundColor: '#fff7ed', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Brand.orange + '55', marginBottom: 16,
  },
  boostTitle: { fontSize: 14, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  boostHint: { fontSize: 12, color: Brand.muted, lineHeight: 17, marginBottom: 12 },
  boostRow: { flexDirection: 'row', gap: 10 },
  boostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Brand.orange, borderRadius: 12, paddingVertical: 12,
  },
  boostBtnOutline: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Brand.orange,
  },
  boostBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
