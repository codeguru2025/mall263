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
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { fetchProductsByStall, type ProductVariant } from '@/lib/seller-api';
import { processSale, type PaymentMethod } from '@/lib/pos-api';
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
  { key: 'INNBUCKS', label: 'InnBucks' },
  { key: 'WALLET', label: 'Wallet' },
  { key: 'BANK_TRANSFER', label: 'Bank' },
];

type View = 'products' | 'cart';

export default function POSCartScreen() {
  const { stallId, stallName } = useLocalSearchParams<{ stallId: string; stallName: string }>();

  const [view, setView] = useState<View>('products');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discount, setDiscount] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processing, setProcessing] = useState(false);

  const productsQ = useQuery({
    queryKey: ['stall-products', stallId],
    queryFn: () => fetchProductsByStall(stallId!, 1, 100),
    enabled: !!stallId,
  });

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
  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  const handleProcess = async () => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add at least one item.'); return; }
    if (!stallId) return;
    setProcessing(true);
    try {
      const sale = await processSale({
        stallId,
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        paymentMethod,
        discountAmount: discountAmt || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      setCart([]);
      setDiscount('');
      setCustomerPhone('');
      router.replace({ pathname: '/pos/receipt/[saleId]', params: { saleId: sale.id } });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not process sale.';
      Alert.alert('Sale failed', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setProcessing(false);
    }
  };

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
            keyExtractor={(item) => item.id}
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

        {/* Optional customer phone */}
        <Text style={styles.sectionLabel}>Customer phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={customerPhone}
          onChangeText={setCustomerPhone}
          placeholder="+263771234567"
          keyboardType="phone-pad"
          placeholderTextColor={Brand.muted}
        />

        {/* Process button */}
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
    backgroundColor: Brand.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
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

  sectionLabel: { fontSize: 12, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  methodBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 2, borderColor: Brand.border, backgroundColor: Brand.card,
  },
  methodBtnActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  methodBtnText: { fontSize: 13, fontWeight: '800', color: Brand.navy },
  methodBtnTextActive: { color: '#fff' },

  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: Brand.text, backgroundColor: Brand.card, marginBottom: 14,
  },

  processBtn: { backgroundColor: Brand.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  processBtnText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  btnDisabled: { opacity: 0.6 },

  empty: { textAlign: 'center', color: Brand.muted, marginTop: 24, fontSize: 14 },
});
