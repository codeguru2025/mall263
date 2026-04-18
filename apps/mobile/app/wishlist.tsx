import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import {
  getWishlist,
  removeFromWishlist,
  type WishlistItem,
} from '@/lib/wishlist';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

export default function WishlistScreen() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);

  const reload = useCallback(async () => {
    setItems(await getWishlist());
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const remove = useCallback(async (id: string) => {
    await removeFromWishlist(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: WishlistItem }) => (
      <Pressable
        style={({ pressed }: { pressed: boolean }) => [styles.card, cardShadow, pressed && styles.cardPressed]}
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
        android_ripple={{ color: Brand.border }}
      >
        <View style={styles.thumbWrap}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={item.id}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPh]}>
              <Text style={styles.thumbLetter}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.price} numberOfLines={1}>
            {formatMoney(item.minPrice, item.currency || 'USD')}
            {String(item.minPrice) !== String(item.maxPrice)
              ? ` – ${formatMoney(item.maxPrice, item.currency || 'USD')}`
              : ''}
          </Text>
        </View>
        <Pressable
          style={styles.heartBtn}
          onPress={() => remove(item.id)}
          hitSlop={8}
          android_ripple={{ color: '#fee2e2', radius: 20 }}
        >
          <FontAwesome name="heart" size={18} color={Brand.red} />
        </Pressable>
      </Pressable>
    ),
    [router, remove],
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={items}
        keyExtractor={(i: { id: string }) => i.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.colWrap}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Wishlist</Text>
            <Text style={styles.heroSub}>
              {items.length > 0 ? `${items.length} saved item${items.length === 1 ? '' : 's'}` : 'Your saved products'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome name="heart-o" size={48} color={Brand.muted} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>
              Tap the heart icon on any product to save it here.
            </Text>
            <Pressable style={styles.browseBtn} onPress={() => router.push('/(tabs)/shop')}>
              <Text style={styles.browseBtnText}>Browse products</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  hero: {
    backgroundColor: Brand.red,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    marginBottom: 14,
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  listContent: { paddingHorizontal: 10, paddingBottom: 24 },
  colWrap: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    flexBasis: '48%',
    maxWidth: '50%',
    backgroundColor: Brand.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  thumbWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#f8fafc' },
  thumb: { width: '100%', height: '100%' },
  thumbPh: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  thumbLetter: { fontSize: 42, fontWeight: '900', color: Brand.blue },
  cardBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 36, gap: 4 },
  name: { fontSize: 13, fontWeight: '800', color: Brand.navy, lineHeight: 18, letterSpacing: -0.1 },
  price: { fontSize: 14, fontWeight: '900', color: Brand.blue, marginTop: 4 },
  heartBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    padding: 6,
    backgroundColor: '#fff0f0',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  empty: { paddingTop: 60, paddingHorizontal: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginTop: 8 },
  emptyBody: { fontSize: 15, color: Brand.muted, textAlign: 'center', lineHeight: 22 },
  browseBtn: {
    marginTop: 8,
    backgroundColor: Brand.blue,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  browseBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
