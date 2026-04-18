import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { io, type Socket } from 'socket.io-client';
import { Brand } from '@/constants/brand';
import {
  fetchChatMessages,
  sendChatMessage,
  uploadChatMedia,
  type ChatAttachmentPayload,
  type ChatMessageRow,
} from '@/lib/chat-api';
import { getApiErrorMessage } from '@/lib/api-errors';
import { getApiBaseUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/token-storage';
import { useAuth } from '@/contexts/AuthContext';

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_COMPRESSION_QUALITY = 0.7;
const BUBBLE_MAX_WIDTH = '82%';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RenderItem = {
  kind: 'message';
  msg: ChatMessageRow;
  mine: boolean;
  grouped: boolean; // true when previous msg is from the same sender within 3 min
  showTime: boolean;
} | {
  kind: 'day';
  day: string;
  key: string;
};

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const resolvedRoomId = Array.isArray(roomId) ? roomId[0] : roomId;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    width: number;
    height: number;
    size: number;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const listRef = useRef<FlatList<RenderItem>>(null);

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
      const current =
        (queryClient.getQueryData(['chat-room', resolvedRoomId]) as ChatMessageRow[] | undefined) ?? [];
      const after = current.length ? current[current.length - 1]?.createdAt : undefined;
      try {
        const incoming = await fetchChatMessages(resolvedRoomId, after);
        if (incoming.length) {
          queryClient.setQueryData(
            ['chat-room', resolvedRoomId],
            (old: ChatMessageRow[] = []) => {
              const ids = new Set(old.map((m) => m.id));
              return [...old, ...incoming.filter((m) => !ids.has(m.id))];
            },
          );
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

  const rows = useMemo(() => q.data ?? [], [q.data]);

  const rendered = useMemo<RenderItem[]>(() => {
    const out: RenderItem[] = [];
    let lastDayKey = '';
    for (let i = 0; i < rows.length; i++) {
      const msg = rows[i];
      const d = new Date(msg.createdAt);
      const dayKey = d.toDateString();
      if (dayKey !== lastDayKey) {
        out.push({ kind: 'day', day: formatDayLabel(d), key: `day-${dayKey}` });
        lastDayKey = dayKey;
      }
      const prev = rows[i - 1];
      const next = rows[i + 1];
      const grouped =
        !!prev &&
        prev.senderId === msg.senderId &&
        new Date(prev.createdAt).toDateString() === dayKey &&
        Math.abs(d.getTime() - new Date(prev.createdAt).getTime()) < 3 * 60 * 1000;
      const nextSameSender =
        !!next &&
        next.senderId === msg.senderId &&
        new Date(next.createdAt).toDateString() === dayKey &&
        Math.abs(new Date(next.createdAt).getTime() - d.getTime()) < 3 * 60 * 1000;
      out.push({
        kind: 'message',
        msg,
        mine: msg.senderId === user?.id,
        grouped,
        showTime: !nextSameSender,
      });
    }
    return out;
  }, [rows, user?.id]);

  useEffect(() => {
    if (!rendered.length) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(timer);
  }, [rendered.length]);

  const sendMut = useMutation({
    mutationFn: async (payload: { content: string; attachment?: ChatAttachmentPayload }) => {
      return sendChatMessage(resolvedRoomId!, payload.content, payload.attachment);
    },
    onSuccess: (created) => {
      queryClient.setQueryData(['chat-room', resolvedRoomId], (old: ChatMessageRow[] = []) => [
        ...old,
        created,
      ]);
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      setDraft('');
      setPendingAttachment(null);
      setPollError(null);
      setPollFailures(0);
    },
    onError: (err) => {
      setPollError(getApiErrorMessage(err, 'Could not send message.'));
    },
  });

  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to send images.');
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
        exif: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      await handleAssetSelected(asset.uri, asset.width ?? 0, asset.height ?? 0);
    } catch (err) {
      Alert.alert('Attach failed', getApiErrorMessage(err, 'Could not load image.'));
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow camera access to take photos.');
        return;
      }
      const picked = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      await handleAssetSelected(asset.uri, asset.width ?? 0, asset.height ?? 0);
    } catch (err) {
      Alert.alert('Camera failed', getApiErrorMessage(err, 'Could not take photo.'));
    }
  }, []);

  const handleAssetSelected = useCallback(
    async (uri: string, originalW: number, originalH: number) => {
      try {
        const longest = Math.max(originalW, originalH) || MAX_IMAGE_DIMENSION;
        const scale = longest > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longest : 1;
        const targetW = Math.round((originalW || MAX_IMAGE_DIMENSION) * scale);
        const targetH = Math.round((originalH || MAX_IMAGE_DIMENSION) * scale);
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          scale < 1 ? [{ resize: { width: targetW, height: targetH } }] : [],
          { compress: IMAGE_COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
        );
        setPendingAttachment({
          uri: manipulated.uri,
          width: manipulated.width,
          height: manipulated.height,
          size: 0,
        });
      } catch (err) {
        Alert.alert('Compression failed', getApiErrorMessage(err, 'Could not process image.'));
      }
    },
    [],
  );

  const attachmentOptions = useCallback(() => {
    Alert.alert('Attach photo', undefined, [
      { text: 'Choose from library', onPress: pickImage },
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage, takePhoto]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!resolvedRoomId) return;
    if (!text && !pendingAttachment) return;
    if (sendMut.isPending || uploadingAttachment) return;

    let attachmentPayload: ChatAttachmentPayload | undefined;
    if (pendingAttachment) {
      setUploadingAttachment(true);
      try {
        const uploaded = await uploadChatMedia(pendingAttachment.uri, {
          mimeType: 'image/jpeg',
          filename: 'chat.jpg',
        });
        attachmentPayload = {
          url: uploaded.url,
          type: 'image',
          width: pendingAttachment.width,
          height: pendingAttachment.height,
          size: uploaded.size || pendingAttachment.size,
        };
      } catch (err) {
        setUploadingAttachment(false);
        Alert.alert('Upload failed', getApiErrorMessage(err, 'Could not upload image.'));
        return;
      } finally {
        setUploadingAttachment(false);
      }
    }

    sendMut.mutate({ content: text, attachment: attachmentPayload });
  }, [draft, pendingAttachment, resolvedRoomId, sendMut, uploadingAttachment]);

  const disabled =
    (!draft.trim() && !pendingAttachment) || sendMut.isPending || uploadingAttachment;
  const reconnecting = !!pollError && pollFailures >= 2;

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
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + 44) : 0}
    >
      <FlatList
        ref={listRef}
        data={rendered}
        keyExtractor={(item: RenderItem) => (item.kind === 'day' ? item.key : `m-${item.msg.id}`)}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: RenderItem }) =>
          item.kind === 'day' ? (
            <DaySeparator label={item.day} />
          ) : (
            <MessageBubble
              msg={item.msg}
              mine={item.mine}
              grouped={item.grouped}
              showTime={item.showTime}
              onImagePress={(uri) => setViewerUri(uri)}
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <FontAwesome name="comments-o" size={32} color={Brand.muted} />
            <Text style={styles.empty}>No messages yet.</Text>
            <Text style={styles.emptySmall}>Say hi or attach a photo to get started.</Text>
          </View>
        }
      />

      {reconnecting ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Reconnecting… {pollError}</Text>
        </View>
      ) : null}

      {pendingAttachment ? (
        <View style={styles.attachmentPreview}>
          <Image source={{ uri: pendingAttachment.uri }} style={styles.attachmentThumb} contentFit="cover" />
          <View style={styles.attachmentMeta}>
            <Text style={styles.attachmentTitle} numberOfLines={1}>
              Photo ready
            </Text>
            <Text style={styles.attachmentSub} numberOfLines={1}>
              {pendingAttachment.width}×{pendingAttachment.height} · compressed
            </Text>
          </View>
          <Pressable
            onPress={() => setPendingAttachment(null)}
            hitSlop={12}
            style={styles.attachmentClose}
          >
            <FontAwesome name="times" size={16} color={Brand.muted} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8) }]}>
        <Pressable
          onPress={attachmentOptions}
          hitSlop={10}
          disabled={sendMut.isPending || uploadingAttachment}
          style={({ pressed }: { pressed: boolean }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <FontAwesome name="paperclip" size={20} color={Brand.muted} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={Brand.muted}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={({ pressed }: { pressed: boolean }) => [
            styles.sendBtn,
            disabled && styles.sendBtnDisabled,
            pressed && !disabled && styles.sendBtnPressed,
          ]}
          disabled={disabled}
          onPress={handleSend}
        >
          {sendMut.isPending || uploadingAttachment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <FontAwesome name="send" size={16} color="#fff" />
          )}
        </Pressable>
      </View>

      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          {viewerUri ? (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImage}
              contentFit="contain"
              transition={180}
            />
          ) : null}
          <Pressable
            style={styles.viewerClose}
            hitSlop={20}
            onPress={() => setViewerUri(null)}
          >
            <FontAwesome name="times" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.daySepWrap}>
      <View style={styles.daySep}>
        <Text style={styles.daySepText}>{label}</Text>
      </View>
    </View>
  );
}

function MessageBubble({
  msg,
  mine,
  grouped,
  showTime,
  onImagePress,
}: {
  msg: ChatMessageRow;
  mine: boolean;
  grouped: boolean;
  showTime: boolean;
  onImagePress: (uri: string) => void;
}) {
  const hasImage = !!msg.attachmentUrl && (msg.attachmentType ?? 'image') === 'image';
  const hasText = !!msg.content && msg.content.trim().length > 0;

  const imageAspect = (() => {
    if (!hasImage) return 1;
    if (msg.attachmentWidth && msg.attachmentHeight && msg.attachmentWidth > 0 && msg.attachmentHeight > 0) {
      return msg.attachmentWidth / msg.attachmentHeight;
    }
    return 1;
  })();

  const bubbleImageMaxW = SCREEN_WIDTH * 0.68;

  return (
    <View
      style={[
        styles.bubbleWrap,
        mine ? styles.mineWrap : styles.otherWrap,
        { marginTop: grouped ? 2 : 10 },
      ]}
    >
      {!mine && !grouped ? (
        <Text style={styles.senderName} numberOfLines={1}>
          {msg.sender?.firstName ?? 'Seller'}
        </Text>
      ) : null}

      <View
        style={[
          styles.bubble,
          mine ? styles.mineBubble : styles.otherBubble,
          !grouped && (mine ? styles.mineTail : styles.otherTail),
          hasImage && !hasText && styles.bubbleImageOnly,
        ]}
      >
        {hasImage ? (
          <Pressable onPress={() => onImagePress(msg.attachmentUrl!)}>
            <Image
              source={{ uri: msg.attachmentUrl! }}
              style={{
                width: bubbleImageMaxW,
                height: bubbleImageMaxW / Math.max(0.6, Math.min(imageAspect, 1.8)),
                borderRadius: 10,
                backgroundColor: '#0001',
              }}
              contentFit="cover"
              transition={120}
            />
          </Pressable>
        ) : null}

        {hasText ? (
          <Text
            style={[
              styles.msgText,
              mine ? styles.mineText : styles.otherText,
              hasImage && { marginTop: 6 },
            ]}
          >
            {msg.content}
          </Text>
        ) : null}

        {showTime ? (
          <Text style={[styles.time, mine ? styles.mineTime : styles.otherTime]}>
            {new Date(msg.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatDayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return that.toLocaleDateString(undefined, { weekday: 'long' });
  return that.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const CHAT_BG = '#ECE5DD'; // WhatsApp-inspired warm beige
const MINE = '#DCF8C6'; // outgoing bubble (WhatsApp green)
const OTHER = '#ffffff';

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: CHAT_BG },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: CHAT_BG,
  },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700', textAlign: 'center' },
  retry: {
    marginTop: 16,
    backgroundColor: Brand.blue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700' },

  list: { padding: 10, paddingBottom: 14 },

  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
    gap: 8,
  },
  empty: { fontSize: 15, color: Brand.muted, fontWeight: '700', marginTop: 8 },
  emptySmall: { fontSize: 13, color: Brand.muted, textAlign: 'center' },

  daySepWrap: { alignItems: 'center', marginVertical: 12 },
  daySep: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#0007',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  daySepText: { fontSize: 11, fontWeight: '700', color: Brand.muted, letterSpacing: 0.3 },

  bubbleWrap: { maxWidth: BUBBLE_MAX_WIDTH },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherWrap: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: Brand.muted, marginBottom: 2, fontWeight: '800', marginLeft: 4 },
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: '#0007',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  mineBubble: { backgroundColor: MINE },
  otherBubble: { backgroundColor: OTHER },
  mineTail: { borderTopRightRadius: 4 },
  otherTail: { borderTopLeftRadius: 4 },
  bubbleImageOnly: { padding: 4 },
  msgText: { fontSize: 15, lineHeight: 20 },
  mineText: { color: '#0b1f0b' },
  otherText: { color: Brand.text },
  time: { marginTop: 4, fontSize: 10, alignSelf: 'flex-end', fontWeight: '600' },
  mineTime: { color: '#34632f' },
  otherTime: { color: Brand.muted },

  banner: {
    backgroundColor: '#fff7d6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1e0a8',
  },
  bannerText: { color: '#725c00', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    padding: 10,
    gap: 10,
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Brand.pageBg,
  },
  attachmentMeta: { flex: 1, gap: 2 },
  attachmentTitle: { fontSize: 13, fontWeight: '800', color: Brand.navy },
  attachmentSub: { fontSize: 11, color: Brand.muted },
  attachmentClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.pageBg,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    borderTopWidth: 1,
    borderTopColor: '#dcd5cb',
    backgroundColor: '#f7f4ef',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { backgroundColor: '#0001' },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    color: Brand.text,
    backgroundColor: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#dcd5cb',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  sendBtnDisabled: { backgroundColor: '#c9c9c9' },

  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
