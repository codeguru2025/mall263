import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { fetchProductsByStall, type ProductVariant } from '@/lib/seller-api';
import { processSale, type PaymentMethod } from '@/lib/pos-api';
import { fetchPaymentConfig, initiateMerchantPayment } from '@/lib/merchant-pay-api';
import { formatMoney } from '@/lib/products';

type CartLine = {
  variantId: string;
  productName: string;
  variantName: string;
  sellingPrice: number;
  quantity: number;
};

const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'ECOCASH', label: 'EcoCash' },
  { key: 'ONEMONEY', label: 'OneMoney' },
  { key: 'INNBUCKS', label: 'InnBucks' },
  { key: 'WALLET', label: 'Wallet' },
  { key: 'BANK_TRANSFER', label: 'Bank' },
];

type CartView = 'products' | 'cart';

export default function POSCartScreen() {
  const { stallId, stallName } = useLocalSearchParams<{ stallId: string; stallName: string }>();

  const [view, setView] = useState<CartView>('products');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discount, setDiscount] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [processing, setProcessing] = useState(false);

  const productsQ = useQuery({
    queryKey: ['stall-products', stallId],
    queryFn: () => fetchProductsByStall(stallId!, 1, 100),
    enabled: !!stallId,
  });

  const payConfigQ = useQuery({
    queryKey: ['stall-pay-config', stallId],
    queryFn: () => fetchPaymentConfig(stallId!),
    enabled: !!stallId,
    staleTime: 60_000,
  });

  const payConfig = payConfigQ.data;
  const hasMerchantCode =
    (paymentMethod === 'ECOCASH' && !!payConfig?.ecocashMerchantCode) ||
    (paymentMethod === 'ONEMONEY' && !!payConfig?.onemoneyMerchantCode);

  const products = productsQ.data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const addToCart = useCallback((product: typeof products[0], variant: ProductVariant) => {
    const price = Number(variant.sellingPrice);
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) => l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { variantId: variant.id, productName: product.name, variantName: variant.name, sellingPrice: price, quantity: 1 }];
    });
  }, []);

  const updateQty = useCallback((variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => l.variantId === variantId ? { ...l, quantity: l.quantity + delta } : l)
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const subtotal = cart.reduce((sum, l) => sum + l.sellingPrice * l.quantity, 0);
  const discountAmt = Math.max(0, Math.min(parseFloat(discount) || 0, subtotal));
  const total = subtotal - discountAmt;
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  const handleProcess = async () => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add at least one item.'); return; }
    if (!stallId) return;
    setProcessing(true);
    try {
      const result = await processSale({
        stallId,
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        paymentMethod,
        discountAmount: discountAmt || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: isDelivery && deliveryAddress.trim() ? deliveryAddress.trim() : undefined,
      });
      setCart([]);
      setDiscount('');
      setCustomerPhone('');
      router.replace({ pathname: '/pos/receipt/[saleId]', params: { saleId: result.sale.id } });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not process sale.';
      Alert.alert('Sale failed', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleMerchantUssd = async () => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add at least one item.'); return; }
    if (!stallId) return;
    const phone = customerPhone.trim();
    if (!phone) { Alert.alert('Phone required', 'Enter the customer\'s mobile number to send the payment request.'); return; }
    setProcessing(true);
    try {
      const result = await initiateMerchantPayment({
        stallId,
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        paymentMethod: paymentMethod as 'ECOCASH' | 'ONEMONEY',
        discountAmount: discountAmt || undefined,
        customerPhone: phone,
      });
      router.push({
        pathname: '/pos/merchant-pay',
        params: {
          reference: result.reference,
          totalAmount: String(result.totalAmount),
          network: result.network,
        },
      } as any);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not send payment request.';
      Alert.alert('Failed', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setProcessing(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!stallId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Brand.pageBg }}>
        <Text style={{ fontSize: 16, color: Brand.muted, textAlign: 'center' }}>No stall selected. Please go back and try again.</Text>
      </View>
    );
  }

  // ── Product browser ─────────────────────────────────────────────────────────

  const renderProduct = ({ item }: { item: typeof products[0] }) => {
    const activeVariants = (item.variants ?? []).filter((v) => v.isActive !== false);
    if (activeVariants.length === 0) return null;

    return (
      <View style={styles.productCard}>
        <Text style={styles.productName}>{item.name}</Text>
        {activeVariants.map((v) => {
          const inCart = cart.find((l) => l.variantId === v.id)?.quantity ?? 0;
          const stock = v.inventory?.quantity ?? 0;
          return (
            <Pressable
              key={v.id}
              style={[styles.variantRow, stock === 0 && styles.variantRowDisabled]}
              onPress={() => stock > 0 && addToCart(item, v)}
              disabled={stock === 0}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.variantName}>{v.name}</Text>
                <Text style={styles.variantStock}>Stock: {stock}</Text>
              </View>
              <Text style={styles.variantPrice}>{formatMoney(v.sellingPrice, 'USD')}</Text>
              {inCart > 0 && (
                <View style={styles.inCartBadge}>
                  <Text style={styles.inCartText}>{inCart}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  if (view === 'products') {
    return (
      <View style={styles.flex}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search products…"
            placeholderTextColor={Brand.muted}
            clearButtonMode="while-editing"
          />
        </View>

        {productsQ.isPending ? (
          <View style={styles.centered}><ActivityIndicator color={Brand.blue} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item: { id: string }) => item.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.productList}
            ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
          />
        )}

        {/* Floating cart button */}
        <Pressable style={styles.cartFab} onPress={() => setView('cart')}>
          <Text style={styles.cartFabText}>
            {cartCount > 0 ? `Cart (${cartCount}) · ${formatMoney(total, 'USD')}` : 'View Cart'}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Cart & checkout ─────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.cartContent} keyboardShouldPersistTaps="handled">

        <Pressable style={styles.backLink} onPress={() => setView('products')}>
          <Text style={styles.backLinkText}>← Add more items</Text>
        </Pressable>

        {/* Cart items */}
        {cart.length === 0 ? (
          <Text style={styles.empty}>Cart is empty.</Text>
        ) : (
          cart.map((line) => (
            <View key={line.variantId} style={styles.cartLine}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cartLineName}>{line.productName}</Text>
                <Text style={styles.cartLineMeta}>{line.variantName} · {formatMoney(line.sellingPrice, 'USD')} each</Text>
              </View>
              <View style={styles.qtyControls}>
                <Pressable style={styles.qtyBtn} onPress={() => updateQty(line.variantId, -1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => updateQty(line.variantId, 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.lineTotal}>{formatMoney(line.sellingPrice * line.quantity, 'USD')}</Text>
            </View>
          ))
        )}

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatMoney(subtotal, 'USD')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount (USD)</Text>
            <TextInput
              style={styles.discountInput}
              value={discount}
              onChangeText={setDiscount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={Brand.muted}
            />
          </View>
          <View style={[styles.totalRow, styles.totalRowBig]}>
            <Text style={styles.totalLabelBig}>Total</Text>
            <Text style={styles.totalValueBig}>{formatMoney(total, 'USD')}</Text>
          </View>
        </View>

        {/* Payment method */}
        <Text style={styles.sectionLabel}>Payment method</Text>
        <View style={styles.methodGrid}>
          {PAYMENT_METHODS.map((m) => (
            <Pressable
              key={m.key}
              style={[styles.methodBtn, paymentMethod === m.key && styles.methodBtnActive]}
              onPress={() => setPaymentMethod(m.key)}
            >
              <Text style={[styles.methodBtnText, paymentMethod === m.key && styles.methodBtnTextActive]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Customer phone — required for merchant payment, optional otherwise */}
        <Text style={[styles.sectionLabel, hasMerchantCode && styles.sectionLabelRequired]}>
          Customer phone{hasMerchantCode ? ' *' : ' (optional)'}
        </Text>
        <TextInput
          style={[styles.input, hasMerchantCode && !customerPhone.trim() && styles.inputHighlight]}
          value={customerPhone}
          onChangeText={setCustomerPhone}
          placeholder="+263771234567"
          keyboardType="phone-pad"
          placeholderTextColor={Brand.muted}
        />

        {/* Delivery toggle — not shown for merchant push payments */}
        {!hasMerchantCode && (
          <>
            <View style={styles.deliveryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Delivery</Text>
                <Text style={styles.deliverySub}>Customer wants item delivered</Text>
              </View>
              <Switch
                value={isDelivery}
                onValueChange={setIsDelivery}
                trackColor={{ false: Brand.border, true: Brand.blue }}
                thumbColor="#fff"
              />
            </View>
            {isDelivery && (
              <TextInput
                style={[styles.input, { marginTop: 6 }]}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Delivery address or instructions"
                placeholderTextColor={Brand.muted}
                multiline
                numberOfLines={2}
              />
            )}
          </>
        )}

        {/* Merchant payment path — EcoCash or OneMoney with merchant code */}
        {hasMerchantCode ? (
          <Pressable
            style={[styles.merchantBtn, (processing || cart.length === 0 || !customerPhone.trim()) && styles.btnDisabled]}
            onPress={handleMerchantUssd}
            disabled={processing || cart.length === 0 || !customerPhone.trim()}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="mobile" size={17} color="#fff" />
                <Text style={styles.merchantBtnText}>
                  Send Payment Request · {formatMoney(total, 'USD')}
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          /* Standard direct charge for cash / wallet / bank / InnBucks */
          <Pressable
            style={[styles.processBtn, (processing || cart.length === 0) && styles.btnDisabled]}
            onPress={handleProcess}
            disabled={processing || cart.length === 0}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.processBtnText}>Charge {formatMoney(total, 'USD')}</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchBar: { padding: 12, backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border },
  searchInput: {
    backgroundColor: Brand.pageBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Brand.text, borderWidth: 1, borderColor: Brand.border,
  },

  productList: { padding: 12, paddingBottom: 100 },
  productCard: {
    backgroundColor: Brand.card, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: Brand.border, overflow: 'hidden',
  },
  productName: { fontSize: 14, fontWeight: '800', color: Brand.navy, padding: 10, paddingBottom: 4 },
  variantRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Brand.border, gap: 8,
  },
  variantRowDisabled: { opacity: 0.4 },
  variantName: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  variantStock: { fontSize: 11, color: Brand.muted, marginTop: 1 },
  variantPrice: { fontSize: 14, fontWeight: '900', color: Brand.blue },
  inCartBadge: {
    backgroundColor: Brand.green, borderRadius: 12, minWidth: 22, height: 22,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  inCartText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  cartFab: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: Brand.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }, android: { elevation: 6 } }),
  },
  cartFabText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  cartContent: { padding: 16, paddingBottom: 48 },
  backLink: { marginBottom: 12 },
  backLinkText: { color: Brand.blue, fontWeight: '700', fontSize: 14 },

  cartLine: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.card, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Brand.border,
  },
  cartLineName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  cartLineMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { backgroundColor: Brand.border, borderRadius: 8, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: Brand.navy, lineHeight: 20 },
  qtyValue: { fontSize: 16, fontWeight: '900', color: Brand.navy, minWidth: 20, textAlign: 'center' },
  lineTotal: { fontSize: 14, fontWeight: '900', color: Brand.navy, minWidth: 60, textAlign: 'right' },

  totalsCard: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Brand.border, marginVertical: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalRowBig: { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: 13, color: Brand.muted, fontWeight: '600' },
  totalValue: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  totalLabelBig: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  totalValueBig: { fontSize: 20, fontWeight: '900', color: Brand.navy },
  discountInput: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: Brand.text,
    backgroundColor: Brand.pageBg, width: 90, textAlign: 'right',
  },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 14 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  deliverySub: { fontSize: 11, color: Brand.muted, marginTop: 1 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  methodBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 2, borderColor: Brand.border, backgroundColor: Brand.card,
  },
  methodBtnActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  methodBtnText: { fontSize: 13, fontWeight: '800', color: Brand.navy },
  methodBtnTextActive: { color: '#fff' },

  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: Brand.text, backgroundColor: Brand.card, marginBottom: 14,
  },
  inputHighlight: { borderColor: Brand.orange, borderWidth: 1.5 },
  sectionLabelRequired: { color: Brand.navy },

  processBtn: { backgroundColor: Brand.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  processBtnText: { color: '#fff', fontWeight: '900', fontSize: 17 },

  merchantBtn: {
    backgroundColor: Brand.blue, borderRadius: 14, paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 6,
  },
  merchantBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },

  empty: { textAlign: 'center', color: Brand.muted, marginTop: 24, fontSize: 14 },
});
