import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { getRecentlyViewed, clearRecentlyViewed, type RecentlyViewedItem } from '@/lib/recently-viewed';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

export default function ForYouScreen() {
  const router = useRouter();
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setItems(await getRecentlyViewed());
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const onClear = useCallback(async () => {
    await clearRecentlyViewed();
    setItems([]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RecentlyViewedItem }) => (
      <Pressable
        style={({ pressed }) => [styles.card, cardShadow, pressed && styles.cardPressed]}
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
      </Pressable>
    ),
    [router],
  );

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>For You</Text>
        <Text style={styles.heroSub}>Products you've browsed recently</Text>
      </View>
      {items.length > 0 && (
        <View style={styles.actionsRow}>
          <Text style={styles.countText}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.clearText}>Clear history</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.colWrap}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} colors={[Brand.blue]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome name="eye" size={48} color={Brand.muted} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Products you view in the shop will appear here so you can pick up where you left off.
            </Text>
            <Pressable style={styles.browseBtn} onPress={() => router.push('/(tabs)/shop')}>
              <Text style={styles.browseBtnText}>Go shopping</Text>
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
    backgroundColor: Brand.navy,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  countText: { fontSize: 12, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  clearText: { fontSize: 13, fontWeight: '700', color: Brand.red },
  listContent: { paddingHorizontal: 10, paddingBottom: 24, paddingTop: 14 },
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
  cardBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, gap: 4 },
  name: { fontSize: 13, fontWeight: '800', color: Brand.navy, lineHeight: 18, letterSpacing: -0.1 },
  price: { fontSize: 14, fontWeight: '900', color: Brand.blue, marginTop: 4 },
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
