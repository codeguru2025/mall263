import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  fetchServiceMessages,
  sendServiceMessage,
  type ServiceChatMessageRow,
} from '@/lib/services-api';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';

export default function ServiceChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ServiceChatMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ServiceChatMessageRow>>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (after?: string) => {
      if (!roomId) return;
      try {
        const fresh = await fetchServiceMessages(roomId, after);
        if (fresh.length === 0) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const next = [...prev];
          for (const m of fresh) if (!seen.has(m.id)) next.push(m);
          next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return next;
        });
      } catch {
        // silent — will retry on next poll
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (!roomId) return;
    (async () => {
      setLoading(true);
      try {
        const initial = await fetchServiceMessages(roomId);
        initial.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setMessages(initial);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const tick = async () => {
      const last = messages[messages.length - 1]?.createdAt;
      await load(last);
      pollRef.current = setTimeout(tick, 4000);
    };
    pollRef.current = setTimeout(tick, 4000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [roomId, messages, load]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const onSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !roomId) return;
    setSending(true);
    try {
      const msg = await sendServiceMessage(roomId, trimmed);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch {
      Alert.alert('Error', 'Message not sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.blue} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome name="comments-o" size={30} color={Brand.muted} />
          <Text style={styles.emptyTitle}>Say hello</Text>
          <Text style={styles.emptySub}>
            Confirm details with the {user?.role === 'BUYER' ? 'provider' : 'client'} before work starts.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m: { id: string }) => m.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: { item: ServiceChatMessageRow }) => {
            const mine = user?.id === item.senderId;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!mine && item.sender ? (
                  <Text style={styles.senderName}>
                    {`${item.sender.firstName ?? ''} ${item.sender.lastName ?? ''}`.trim()}
                  </Text>
                ) : null}
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
                <Text style={[styles.timeText, mine && styles.timeTextMine]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor="#9ca3af"
          editable={!sending}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, (sending || !draft.trim()) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={sending || !draft.trim()}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <FontAwesome name="paper-plane" size={14} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 13, color: Brand.muted, textAlign: 'center' },

  listContent: { padding: 12, paddingBottom: 24 },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  senderName: { fontSize: 11, fontWeight: '800', color: Brand.blue, marginBottom: 2 },
  bubbleText: { fontSize: 14, color: Brand.text, lineHeight: 19 },
  bubbleTextMine: { color: '#0f172a' },
  timeText: { fontSize: 10, color: Brand.muted, alignSelf: 'flex-end', marginTop: 3 },
  timeTextMine: { color: '#4b5563' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 8,
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: Brand.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.55 },
});
