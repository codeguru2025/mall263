import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  acceptServiceQuote,
  completeServiceQuote,
  fetchServiceRequest,
  openServiceChatRoom,
  rejectServiceQuote,
  submitServiceQuote,
  type ServiceQuote,
  type ServiceRequestStatus,
} from '@/lib/services-api';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';

const STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  OPEN: 'Awaiting quote',
  QUOTED: 'Quote received',
  ACCEPTED: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatMoney(value: unknown, currency = 'USD') {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

export default function ServiceRequestDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDesc, setQuoteDesc] = useState('');
  const [quoteDays, setQuoteDays] = useState('');
  const [openingChat, setOpeningChat] = useState(false);

  const reqQ = useQuery({
    queryKey: ['service-request', requestId],
    queryFn: () => fetchServiceRequest(requestId!),
    enabled: !!requestId,
  });

  const req = reqQ.data;
  const listing = req?.listing ?? null;
  const isClient = !!req && user?.id === req.clientId;
  const isProvider = !!listing?.provider && user?.id === listing.provider.id;
  const canSubmitQuote = isProvider && req?.status === 'OPEN';

  const acceptMut = useMutation({
    mutationFn: (quoteId: string) => acceptServiceQuote(quoteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-request', requestId] });
      Alert.alert('Quote accepted', 'Chat is now open with the provider.');
    },
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not accept quote.')),
  });

  const rejectMut = useMutation({
    mutationFn: (quoteId: string) => rejectServiceQuote(quoteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-request', requestId] }),
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not reject quote.')),
  });

  const completeMut = useMutation({
    mutationFn: (quoteId: string) => completeServiceQuote(quoteId, 'CASH'),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: ['service-request', requestId] });
      Alert.alert('Service completed', 'Invoice generated.', [
        {
          text: 'Open invoice',
          onPress: () =>
            router.push({ pathname: '/services/invoice/[invoiceId]', params: { invoiceId: invoice.id } }),
        },
      ]);
    },
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not complete the job.')),
  });

  const submitQuoteMut = useMutation({
    mutationFn: () => {
      const amt = parseFloat(quoteAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return Promise.reject(new Error('Enter a valid amount.'));
      }
      const daysN = quoteDays.trim() ? parseInt(quoteDays, 10) : undefined;
      return submitServiceQuote(requestId!, {
        amount: amt,
        description: quoteDesc.trim() || undefined,
        estimatedDays: Number.isFinite(daysN ?? NaN) ? daysN : undefined,
      });
    },
    onSuccess: () => {
      setQuoteModalOpen(false);
      setQuoteAmount('');
      setQuoteDesc('');
      setQuoteDays('');
      qc.invalidateQueries({ queryKey: ['service-request', requestId] });
      qc.invalidateQueries({ queryKey: ['service-requests-incoming'] });
      Alert.alert('Quote submitted', 'The client will be notified.');
    },
    onError: (err) =>
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : extractErr(err, 'Could not submit quote.'),
      ),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reqQ.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const openChat = async (quoteId: string) => {
    setOpeningChat(true);
    try {
      const room = await openServiceChatRoom(quoteId);
      router.push({ pathname: '/services/chat/[roomId]', params: { roomId: room.id } });
    } catch (err) {
      Alert.alert('Cannot open chat', extractErr(err, 'Please try again.'));
    } finally {
      setOpeningChat(false);
    }
  };

  if (reqQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }

  if (!req) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errTitle}>Request not found</Text>
      </View>
    );
  }

  const quotes = req.quotes ?? [];

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <FontAwesome name="briefcase" size={18} color={Brand.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {listing?.title ?? 'Service'}
              </Text>
              <Text style={styles.metaLine}>
                {STATUS_LABEL[req.status] ?? req.status} · {new Date(req.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          {req.notes ? (
            <>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notesText}>{req.notes}</Text>
            </>
          ) : null}
          {req.budgetHint ? (
            <View style={styles.budgetBadge}>
              <FontAwesome name="tag" size={11} color={Brand.blue} />
              <Text style={styles.budgetText}>
                Budget hint: {formatMoney(req.budgetHint, listing?.currency ?? 'USD')}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.quotesHeader}>Quotes ({quotes.length})</Text>

        {quotes.length === 0 ? (
          <View style={[styles.card, styles.emptyQuotes]}>
            <FontAwesome name="hourglass-half" size={22} color={Brand.muted} />
            <Text style={styles.emptyQuotesText}>
              {isProvider ? 'You haven\u2019t sent a quote yet.' : 'Waiting for a quote from the provider.'}
            </Text>
          </View>
        ) : (
          quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              currency={listing?.currency ?? 'USD'}
              isClient={isClient}
              isProvider={isProvider}
              onAccept={() => acceptMut.mutate(quote.id)}
              onReject={() => rejectMut.mutate(quote.id)}
              onComplete={() => completeMut.mutate(quote.id)}
              onChat={() => openChat(quote.id)}
              busy={acceptMut.isPending || rejectMut.isPending || completeMut.isPending || openingChat}
            />
          ))
        )}

        {canSubmitQuote ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={() => setQuoteModalOpen(true)}
          >
            <FontAwesome name="paper-plane" size={14} color="#fff" />
            <Text style={styles.primaryBtnText}>Submit a quote</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={quoteModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuoteModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Submit a quote</Text>

            <Text style={styles.label}>Amount (USD)</Text>
            <TextInput
              style={styles.input}
              value={quoteAmount}
              onChangeText={setQuoteAmount}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Scope / description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={quoteDesc}
              onChangeText={setQuoteDesc}
              placeholder="What\u2019s included, materials, assumptions..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Estimated days (optional)</Text>
            <TextInput
              style={styles.input}
              value={quoteDays}
              onChangeText={setQuoteDays}
              placeholder="e.g. 3"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />

            <Pressable
              style={[styles.primaryBtn, submitQuoteMut.isPending && styles.primaryBtnDisabled]}
              onPress={() => submitQuoteMut.mutate()}
              disabled={submitQuoteMut.isPending}
            >
              {submitQuoteMut.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Send quote</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => setQuoteModalOpen(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function QuoteCard({
  quote,
  currency,
  isClient,
  isProvider,
  onAccept,
  onReject,
  onComplete,
  onChat,
  busy,
}: {
  quote: ServiceQuote;
  currency: string;
  isClient: boolean;
  isProvider: boolean;
  onAccept: () => void;
  onReject: () => void;
  onComplete: () => void;
  onChat: () => void;
  busy: boolean;
}) {
  const provName = quote.provider
    ? `${quote.provider.firstName ?? ''} ${quote.provider.lastName ?? ''}`.trim()
    : '';
  const isPending = quote.status === 'PENDING';
  const isAccepted = quote.status === 'ACCEPTED';

  return (
    <View style={styles.card}>
      <View style={styles.quoteHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.quoteAmount}>{formatMoney(quote.amount, currency)}</Text>
          {provName ? <Text style={styles.quoteProvider}>by {provName}</Text> : null}
        </View>
        <View style={[styles.quoteStatus, quote.status === 'ACCEPTED' && styles.quoteStatusOk]}>
          <Text
            style={[styles.quoteStatusText, quote.status === 'ACCEPTED' && styles.quoteStatusTextOk]}
          >
            {quote.status}
          </Text>
        </View>
      </View>
      {quote.description ? <Text style={styles.quoteDesc}>{quote.description}</Text> : null}
      {quote.estimatedDays ? (
        <Text style={styles.quoteDays}>Estimated {quote.estimatedDays} day(s)</Text>
      ) : null}

      {isPending && isClient ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn, busy && styles.btnDisabled]}
            onPress={onReject}
            disabled={busy}
          >
            <Text style={styles.rejectBtnText}>Reject</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn, busy && styles.btnDisabled]}
            onPress={onAccept}
            disabled={busy}
          >
            <Text style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
        </View>
      ) : null}

      {isAccepted ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.chatBtn, busy && styles.btnDisabled]}
            onPress={onChat}
            disabled={busy}
          >
            <FontAwesome name="comments" size={13} color={Brand.blue} />
            <Text style={styles.chatBtnText}>Chat</Text>
          </Pressable>
          {isProvider ? (
            <Pressable
              style={[styles.actionBtn, styles.acceptBtn, busy && styles.btnDisabled]}
              onPress={onComplete}
              disabled={busy}
            >
              <Text style={styles.acceptBtnText}>Mark complete</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function extractErr(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: string | string[] } | undefined;
    const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
    if (m) return m;
  }
  return fallback;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { padding: 14, paddingBottom: 40, gap: 12 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, backgroundColor: Brand.pageBg },
  errTitle: { fontSize: 15, fontWeight: '800', color: Brand.navy },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '900', color: Brand.navy, letterSpacing: -0.2 },
  metaLine: { fontSize: 12, color: Brand.muted, marginTop: 3 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  notesText: { fontSize: 14, color: Brand.text, lineHeight: 19 },

  budgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#eff6fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  budgetText: { fontSize: 12, fontWeight: '800', color: Brand.blue },

  quotesHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Brand.navy,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 2,
  },

  emptyQuotes: { alignItems: 'center', gap: 10, paddingVertical: 22 },
  emptyQuotesText: { fontSize: 13, color: Brand.muted, textAlign: 'center' },

  quoteHeader: { flexDirection: 'row', alignItems: 'center' },
  quoteAmount: { fontSize: 20, fontWeight: '900', color: Brand.blue, letterSpacing: -0.3 },
  quoteProvider: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  quoteStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  quoteStatusOk: { backgroundColor: '#ecfdf5' },
  quoteStatusText: { fontSize: 10, fontWeight: '800', color: Brand.navy },
  quoteStatusTextOk: { color: '#047857' },
  quoteDesc: { fontSize: 13, color: Brand.text, marginTop: 8, lineHeight: 18 },
  quoteDays: { fontSize: 12, color: Brand.muted, marginTop: 6 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.55 },
  rejectBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  rejectBtnText: { color: '#b91c1c', fontWeight: '800' },
  acceptBtn: { backgroundColor: Brand.blue },
  acceptBtnText: { color: '#fff', fontWeight: '800' },
  chatBtn: { backgroundColor: '#eff6fc', borderWidth: 1, borderColor: Brand.border },
  chatBtnText: { color: Brand.blue, fontWeight: '800' },

  primaryBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: Brand.navy, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '800', color: Brand.navy, marginTop: 6, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: '#fafbfd',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 10 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { color: Brand.muted, fontWeight: '700' },
});
