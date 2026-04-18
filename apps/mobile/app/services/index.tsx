import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { browseServices, type ServiceListing } from '@/lib/services-api';
import { Brand } from '@/constants/brand';

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function formatFrom(value: unknown, currency?: string) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return `from ${currency ?? 'USD'} ${n.toFixed(2)}`;
}

export default function ServicesBrowseScreen() {
  const [searchRaw, setSearchRaw] = useState('');
  const debouncedQ = useDebouncedValue(searchRaw, 350);
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['services-browse', debouncedQ],
    queryFn: () => browseServices({ q: debouncedQ.trim() || undefined, limit: 40 }),
  });

  const items = q.data?.data ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Services</Text>
        <Text style={styles.heroSub}>Hire local experts, get quotes, pay when the job is done.</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <FontAwesome name="search" size={14} color={Brand.muted} />
          <TextInput
            style={styles.searchInput}
            value={searchRaw}
            onChangeText={setSearchRaw}
            placeholder="Search e.g. plumber, photographer, tutor"
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
          />
          {searchRaw.length > 0 ? (
            <Pressable onPress={() => setSearchRaw('')} hitSlop={8}>
              <FontAwesome name="times-circle" size={16} color={Brand.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={styles.requestsBtn}
          onPress={() => router.push('/services/requests')}
          hitSlop={6}
        >
          <FontAwesome name="inbox" size={14} color={Brand.blue} />
          <Text style={styles.requestsBtnText}>My requests</Text>
        </Pressable>
      </View>

      {q.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.blue} />
        </View>
      ) : q.isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load services</Text>
          <Text style={styles.emptySub}>Pull to refresh or try again.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome name="briefcase" size={32} color={Brand.muted} />
          <Text style={styles.emptyTitle}>No services match yet</Text>
          <Text style={styles.emptySub}>Try different keywords or clear the search.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it: { id: string }) => it.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: ServiceListing }) => <ListingCard item={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

function ListingCard({ item }: { item: ServiceListing }) {
  const priceLine = formatFrom(item.priceFrom, item.currency);
  const mallLine = item.mall ? [item.mall.name, item.mall.city].filter(Boolean).join(' · ') : null;
  const providerName = item.provider
    ? `${item.provider.firstName ?? ''} ${item.provider.lastName ?? ''}`.trim()
    : '';

  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: '/services/[id]', params: { id: item.id } })}
    >
      <View style={styles.thumbWrap}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.thumb}
            contentFit="cover"
            transition={160}
          />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <FontAwesome name="briefcase" size={26} color={Brand.blue} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.category?.name ? (
          <Text style={styles.meta} numberOfLines={1}>
            {item.category.name}
          </Text>
        ) : null}
        {mallLine ? (
          <View style={styles.metaRow}>
            <FontAwesome name="map-marker" size={10} color={Brand.muted} />
            <Text style={styles.meta} numberOfLines={1}>{mallLine}</Text>
          </View>
        ) : null}
        {providerName ? (
          <Text style={styles.provider} numberOfLines={1}>by {providerName}</Text>
        ) : null}
        {priceLine ? <Text style={styles.price}>{priceLine}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },

  hero: {
    backgroundColor: Brand.navy,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { color: '#ffffffcc', fontSize: 13, marginTop: 4, lineHeight: 18 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: -14,
    marginBottom: 6,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 7,
    gap: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Brand.text },
  requestsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  requestsBtnText: { color: Brand.blue, fontWeight: '800', fontSize: 12 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 13, color: Brand.muted, textAlign: 'center' },

  list: { padding: 12, paddingBottom: 32 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.995 }] },

  thumbWrap: { width: 110, height: 110, backgroundColor: '#f8fafc' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f1fb',
  },

  cardBody: { flex: 1, padding: 12, gap: 3 },
  title: { fontSize: 14, fontWeight: '800', color: Brand.navy },
  meta: { fontSize: 11, color: Brand.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  provider: { fontSize: 11, color: Brand.muted, fontStyle: 'italic', marginTop: 2 },
  price: { fontSize: 13, fontWeight: '900', color: Brand.blue, marginTop: 5 },
});
