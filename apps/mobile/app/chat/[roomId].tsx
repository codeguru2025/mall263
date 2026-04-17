import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { io, type Socket } from 'socket.io-client';
import { Brand } from '@/constants/brand';
import { fetchChatMessages, sendChatMessage, type ChatMessageRow } from '@/lib/chat-api';
import { getApiErrorMessage } from '@/lib/api-errors';
import { getApiBaseUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/token-storage';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const resolvedRoomId = Array.isArray(roomId) ? roomId[0] : roomId;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessageRow>>(null);

  const q = useQuery({
    queryKey: ['chat-room', resolvedRoomId],
    queryFn: async () => {
      try {
        const rows = await fetchChatMessages(resolvedRoomId!);
        setLoadError(null);
        return rows;
      } catch (err) {
        const msg = getApiErrorMessage(err, 'Could not load this chat room.');
        setLoadError(msg);
        throw err;
      }
    },
    enabled: !!resolvedRoomId,
  });
  const { refetch } = q;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  useEffect(() => {
    if (!resolvedRoomId) return;
    const interval = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      const current = (queryClient.getQueryData(['chat-room', resolvedRoomId]) as ChatMessageRow[] | undefined) ?? [];
      const after = current.length ? current[current.length - 1]?.createdAt : undefined;
      try {
        const incoming = await fetchChatMessages(resolvedRoomId, after);
        if (incoming.length) {
          queryClient.setQueryData(['chat-room', resolvedRoomId], (old: ChatMessageRow[] = []) => {
            const ids = new Set(old.map((m) => m.id));
            return [...old, ...incoming.filter((m) => !ids.has(m.id))];
          });
          queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
        }
        setPollError(null);
        setPollFailures(0);
      } catch (err) {
        setPollFailures((n) => n + 1);
        setPollError(getApiErrorMessage(err, 'Failed to refresh messages.'));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [resolvedRoomId, queryClient]);

  useEffect(() => {
    if (!resolvedRoomId) return;
    let socket: Socket | null = null;
    let mounted = true;

    (async () => {
      const token = await getAccessToken();
      if (!token || !mounted) return;

      socket = io(`${getApiBaseUrl()}/chat`, {
        transports: ['websocket', 'polling'],
        auth: { token: `Bearer ${token}` },
      });

      socket.on('connect', () => {
        socket?.emit('chat.join', { roomId: resolvedRoomId });
      });

      socket.on('chat.message', (msg: ChatMessageRow) => {
        if (!msg?.id) return;
        queryClient.setQueryData(['chat-room', resolvedRoomId], (old: ChatMessageRow[] = []) => {
          if (old.some((m) => m.id === msg.id)) return old;
          return [...old, msg];
        });
        queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      });

      socket.on('connect_error', () => {
        setPollError((prev) => prev ?? 'Realtime connection unavailable. Using fallback refresh.');
      });
    })();

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [resolvedRoomId, queryClient]);

  useEffect(() => {
    const rows = q.data ?? [];
    if (!rows.length) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [q.data]);

  const sendMut = useMutation({
    mutationFn: (content: string) => sendChatMessage(resolvedRoomId!, content),
    onSuccess: (created) => {
      queryClient.setQueryData(['chat-room', resolvedRoomId], (old: ChatMessageRow[] = []) => [...old, created]);
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      setDraft('');
      setPollError(null);
      setPollFailures(0);
    },
    onError: (err) => {
      setPollError(getApiErrorMessage(err, 'Could not send message.'));
    },
  });

  const disabled = !draft.trim() || sendMut.isPending;
  const rows = useMemo(() => q.data ?? [], [q.data]);

  if (!resolvedRoomId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing chat room.</Text>
      </View>
    );
  }

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading messages…</Text>
      </View>
    );
  }

  if (q.isError && !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError || 'Could not load this chat room.'}</Text>
        <Text style={styles.debug} selectable>
          room id: {String(resolvedRoomId ?? 'missing')}
        </Text>
        <Text style={styles.debug} selectable>
          raw: {JSON.stringify(roomId)}
        </Text>
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const reconnecting = !!pollError && pollFailures >= 2;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.otherWrap]}>
              {!mine ? <Text style={styles.sender}>{item.sender?.firstName ?? 'Seller'}</Text> : null}
              <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble]}>
                <Text style={[styles.msgText, mine ? styles.mineText : styles.otherText]}>{item.content}</Text>
              </View>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No messages yet. Start the conversation.</Text>}
      />

      {reconnecting ? <Text style={styles.pollError}>Reconnecting… {pollError}</Text> : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={Brand.muted}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}
          disabled={disabled}
          onPress={() => sendMut.mutate(draft.trim())}
        >
          <Text style={styles.sendText}>{sendMut.isPending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  list: { padding: 14, paddingBottom: 20 },
  bubbleWrap: { marginBottom: 12, maxWidth: '86%' },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherWrap: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { fontSize: 11, color: Brand.muted, marginBottom: 3, fontWeight: '700' },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  mineBubble: { backgroundColor: Brand.blue, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#ffffff', borderColor: Brand.border, borderWidth: 1, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  mineText: { color: '#fff' },
  otherText: { color: Brand.navy },
  time: { marginTop: 4, fontSize: 10, color: Brand.muted, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Brand.navy,
    backgroundColor: Brand.pageBg,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.55 },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700', textAlign: 'center' },
  debug: {
    marginTop: 10,
    fontSize: 11,
    color: Brand.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 16, fontSize: 14 },
  pollError: { color: Brand.red, fontSize: 12, paddingHorizontal: 12, paddingBottom: 6, textAlign: 'center' },
});
