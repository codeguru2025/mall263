import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { useRunCart } from '@/contexts/RunCartContext';
import { formatMoney } from '@/lib/products';

export default function RunCartScreen() {
  const router = useRouter();
  const { stops, totalItems, totalAmount, removeItem, setQty, clear } = useRunCart();

  if (stops.length === 0) {
    return (
      <View style={styles.empty}>
        <FontAwesome name="shopping-basket" size={48} color={Brand.border} />
        <Text style={styles.emptyTitle}>Your run cart is empty</Text>
        <Text style={styles.emptyDesc}>Add products from different stores — they'll be grouped here for one delivery.</Text>
        <Pressable style={styles.browseBtn} onPress={() => router.push('/(tabs)/shop')}>
          <Text style={styles.browseBtnText}>Browse shops</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {stops.map((stop) => (
          <View key={stop.stallId} style={styles.stopCard}>
            <View style={styles.stopHeader}>
              <FontAwesome name="map-marker" size={13} color={Brand.primary} />
              <Text style={styles.stopName}>{stop.stallName}</Text>
              <Text style={styles.stopZone}>{stop.zone}</Text>
            </View>
            {stop.items.map((item) => (
              <View key={item.variantId} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.productName} — {item.variantName}
                  </Text>
                  <Text style={styles.itemPrice}>{formatMoney(item.unitPrice, item.currency)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => setQty(stop.stallId, item.variantId, item.quantity - 1)}
                    hitSlop={8}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyNum}>{item.quantity}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => setQty(stop.stallId, item.variantId, item.quantity + 1)}
                    hitSlop={8}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeItem(stop.stallId, item.variantId)}
                    hitSlop={8}
                  >
                    <FontAwesome name="trash-o" size={15} color={Brand.red} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shops</Text>
            <Text style={styles.summaryValue}>{stops.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total items</Text>
            <Text style={styles.summaryValue}>{totalItems}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>Items total</Text>
            <Text style={[styles.summaryValue, styles.summaryBig]}>{formatMoney(totalAmount, 'USD')}</Text>
          </View>
          <Text style={styles.summaryNote}>Delivery fee is added at checkout — drivers compete for the best rate.</Text>
        </View>

        <Pressable
          style={styles.clearBtn}
          onPress={clear}
          android_ripple={{ color: '#ff000011' }}
        >
          <Text style={styles.clearBtnText}>Clear cart</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.checkoutBtn}
          onPress={() => router.push('/runs/new' as never)}
          android_ripple={{ color: '#ffffff33' }}
        >
          <FontAwesome name="truck" size={16} color="#fff" />
          <Text style={styles.checkoutBtnText}>Post this run — {stops.length} stop{stops.length !== 1 ? 's' : ''}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 100 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Brand.pageBg },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginTop: 14, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Brand.muted, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  browseBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  browseBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  stopCard: {
    backgroundColor: Brand.card, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Brand.border, overflow: 'hidden',
  },
  stopHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Brand.primary + '10', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  stopName: { flex: 1, fontSize: 13, fontWeight: '800', color: Brand.navy },
  stopZone: { fontSize: 11, color: Brand.muted, fontWeight: '600' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.border,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  itemPrice: { fontSize: 13, fontWeight: '800', color: Brand.primary, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.pageBg, borderWidth: 1, borderColor: Brand.border,
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: Brand.navy },
  qtyNum: { fontSize: 15, fontWeight: '800', color: Brand.navy, minWidth: 20, textAlign: 'center' },
  removeBtn: { padding: 4 },

  summaryCard: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { fontSize: 14, color: Brand.muted, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  summaryBig: { fontSize: 18, color: Brand.primary, fontWeight: '900' },
  summaryNote: { fontSize: 11, color: Brand.muted, marginTop: 10, lineHeight: 16 },

  clearBtn: { alignItems: 'center', marginTop: 14, padding: 12 },
  clearBtnText: { fontSize: 13, color: Brand.red, fontWeight: '700' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Brand.card, padding: 14, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Brand.border,
  },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12,
  },
  checkoutBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
