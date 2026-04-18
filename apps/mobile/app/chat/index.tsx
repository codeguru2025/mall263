import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { Brand } from '@/constants/brand';
import { fetchMyChatRoomsSafe, type ChatRoomRow } from '@/lib/chat-api';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; prismaCode?: string }
      | undefined;
    const msg = Array.isArray(data?.message) ? data?.message.join(', ') : data?.message;
    const code = data?.prismaCode ? ` [${data.prismaCode}]` : '';
    if (typeof msg === 'string' && msg.trim()) return `${msg}${code}`;
    if (err.response?.status === 401) return 'Please sign in again to view chats.';
    if (err.response && err.response.status >= 500) {
      return 'Chat service is temporarily unavailable. Please try again shortly.';
    }
    if (err.message === 'Network Error') return 'No connection — check your internet and retry.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

function formatWhen(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function roomTitle(room: ChatRoomRow): string {
  const demandTitle = room.offer?.demand?.title?.trim();
  if (demandTitle) return demandTitle;
  return 'Offer chat';
}

function roomSubTitle(room: ChatRoomRow): string {
  const stall = room.offer?.stall?.name?.trim();
  if (stall) return stall;
  return 'Accepted offer conversation';
}

export default function ChatInboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: fetchMyChatRoomsSafe,
    refetchInterval: 10000,
  });
  const { refetch } = q;
  const rooms = q.data?.rooms ?? [];
  const softError = q.data?.softError;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') refetch();
      });
      return () => sub.remove();
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.subtitle}>Messages from accepted demand offers.</Text>
        {softError ? (
          <View style={styles.softBanner}>
            <Text style={styles.softBannerTitle}>Inbox may be incomplete</Text>
            <Text style={styles.softBannerBody}>{softError}</Text>
            <Pressable onPress={() => q.refetch()} style={styles.softBannerRetry}>
              <Text style={styles.softBannerRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [softError, q],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatRoomRow }) => {
      const last = item.messages?.[0];
      const unread = !!last?.sender?.id && last.sender.id !== user?.id;
      return (
        <Pressable
          style={[styles.card, cardShadow]}
          onPress={() => router.push({ pathname: '/chat/[roomId]', params: { roomId: item.id } })}
        >
          <View style={styles.topRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {roomTitle(item)}
            </Text>
            <Text style={styles.when}>{formatWhen(last?.createdAt || item.createdAt)}</Text>
          </View>
          <Text style={styles.cardSub} numberOfLines={1}>
            {roomSubTitle(item)}
          </Text>
          {unread ? (
            <View style={styles.unreadRow}>
              <View style={styles.unreadDot} />
              <Text style={styles.unreadText}>Unread</Text>
            </View>
          ) : null}
          <Text style={styles.preview} numberOfLines={2}>
            {last ? `${last.sender?.firstName ?? 'User'}: ${last.content}` : 'No messages yet. Start the conversation.'}
          </Text>
        </Pressable>
      );
    },
    [router, user?.id],
  );

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading chats…</Text>
      </View>
    );
  }

  if (q.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Chats unavailable</Text>
        <Text style={styles.errorBody}>{extractErrorMessage(q.error)}</Text>
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={rooms}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>No chat rooms yet. Accept an offer to start chatting.</Text>}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', color: Brand.navy },
  subtitle: { marginTop: 4, fontSize: 13, color: Brand.muted, fontWeight: '600' },
  card: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Brand.navy },
  when: { fontSize: 11, color: Brand.muted, fontWeight: '600' },
  cardSub: { marginTop: 4, fontSize: 13, color: Brand.blue, fontWeight: '700' },
  unreadRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: Brand.orange },
  unreadText: { fontSize: 12, fontWeight: '800', color: Brand.orange },
  preview: { marginTop: 8, fontSize: 13, color: Brand.text, lineHeight: 18 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  errorTitle: { color: Brand.red, fontWeight: '800', fontSize: 18, marginBottom: 8 },
  errorBody: { color: Brand.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 20, fontSize: 15, paddingHorizontal: 12 },
  softBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  softBannerTitle: { fontWeight: '800', color: '#92400E', marginBottom: 4 },
  softBannerBody: { color: '#78350F', fontSize: 12, lineHeight: 16 },
  softBannerRetry: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#92400E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  softBannerRetryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
