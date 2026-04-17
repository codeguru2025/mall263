import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFilter,
  type NotificationRow,
} from '@/lib/notifications-api';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['notifications', filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchNotificationsPage(pageParam as number, 20, filter),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => invalidate(),
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => invalidate(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  }, [query]);

  const onPressRow = useCallback(
    (item: NotificationRow) => {
      if (!item.isRead) readMutation.mutate(item.id);
    },
    [readMutation],
  );

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.heroBar}>
          <Text style={styles.heroTitle}>Notifications</Text>
          <Text style={styles.heroTag}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filter === 'all' && styles.filterChipOn]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextOn]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filter === 'unread' && styles.filterChipOn]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.filterChipText, filter === 'unread' && styles.filterChipTextOn]}>Unread</Text>
          </Pressable>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            style={[styles.markAllBtn, readAllMutation.isPending && styles.btnDisabled]}
            onPress={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
          >
            <Text style={styles.markAllBtnText}>
              {readAllMutation.isPending ? 'Marking…' : 'Mark all as read'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [filter, unreadCount, readAllMutation.isPending, readAllMutation.mutate],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationRow }) => (
      <Pressable
        style={[styles.card, cardShadow, !item.isRead && styles.cardUnread]}
        onPress={() => onPressRow(item)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.typePill}>{item.type.replace(/_/g, ' ')}</Text>
          <Text style={styles.time}>{formatWhen(item.createdAt)}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        {!item.isRead ? <Text style={styles.tapHint}>Tap to mark read</Text> : null}
      </Pressable>
    ),
    [onPressRow],
  );

  if (query.isPending && !query.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading notifications…</Text>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load notifications.</Text>
        <Pressable style={styles.retry} onPress={() => query.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={Brand.blue} />
        ) : null
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No notifications yet.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  headerBlock: { paddingTop: 8, marginBottom: 12 },
  heroBar: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroTag: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  filterChipOn: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  filterChipText: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  filterChipTextOn: { color: '#fff' },
  markAllBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Brand.pageBg,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 8,
  },
  markAllBtnText: { fontSize: 13, fontWeight: '700', color: Brand.blue },
  btnDisabled: { opacity: 0.6 },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: Brand.blue },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typePill: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  time: { fontSize: 11, color: Brand.muted },
  title: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginBottom: 6 },
  body: { fontSize: 14, color: Brand.text, lineHeight: 20 },
  tapHint: { fontSize: 12, color: Brand.blue, fontWeight: '600', marginTop: 10 },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 24, fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
