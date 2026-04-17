import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchServiceInvoice, markServiceInvoicePaid } from '@/lib/services-api';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';

function formatMoney(value: unknown, currency = 'USD') {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

export default function ServiceInvoiceScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['service-invoice', invoiceId],
    queryFn: () => fetchServiceInvoice(invoiceId!),
    enabled: !!invoiceId,
  });

  const payMut = useMutation({
    mutationFn: () => markServiceInvoicePaid(invoiceId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-invoice', invoiceId] });
      Alert.alert('Marked paid', 'Invoice has been settled.');
    },
    onError: (err) => {
      let msg = 'Could not mark as paid.';
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Error', msg);
    },
  });

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errTitle}>Couldn&apos;t load invoice</Text>
      </View>
    );
  }

  const inv = q.data;
  // The provider is the only one who can mark paid; derive basic ownership from quote.
  // We don't have quote.providerId on the invoice shape, so assume only providers hit this path.
  const canMarkPaid =
    inv.status === 'PENDING' &&
    (user?.role === 'STALL_OWNER' || user?.role === 'ATTENDANT' || user?.role === 'SUPER_ADMIN');

  const isPaid = inv.status === 'PAID';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.hero}>
        <View style={styles.statusPill}>
          <FontAwesome
            name={isPaid ? 'check-circle' : 'file-text-o'}
            size={13}
            color={isPaid ? '#16a34a' : '#ea580c'}
          />
          <Text style={[styles.statusText, isPaid && { color: '#16a34a' }]}>{inv.status}</Text>
        </View>
        <Text style={styles.invoiceLabel}>Invoice</Text>
        <Text style={styles.invoiceNumber}>#{inv.invoiceNumber}</Text>
        <Text style={styles.total}>{formatMoney(inv.totalAmount)}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Service" value={inv.quote?.request?.listing?.title ?? '—'} />
        <Row
          label="Provider"
          value={
            inv.quote?.provider
              ? `${inv.quote.provider.firstName ?? ''} ${inv.quote.provider.lastName ?? ''}`.trim() || '—'
              : '—'
          }
        />
        <Row label="Payment method" value={inv.paymentMethod} />
        <Row label="Issued" value={new Date(inv.createdAt).toLocaleDateString()} />
      </View>

      {canMarkPaid ? (
        <Pressable
          style={[styles.payBtn, payMut.isPending && styles.payBtnDisabled]}
          onPress={() => payMut.mutate()}
          disabled={payMut.isPending}
        >
          {payMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome name="check" size={15} color="#fff" />
              <Text style={styles.payBtnText}>Mark as paid</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { padding: 14, gap: 12, paddingBottom: 40 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Brand.pageBg },
  errTitle: { fontSize: 15, fontWeight: '800', color: Brand.navy },

  hero: {
    backgroundColor: Brand.navy,
    padding: 22,
    borderRadius: 18,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusText: { fontSize: 11, fontWeight: '900', color: '#ea580c', letterSpacing: 0.5 },
  invoiceLabel: { color: '#ffffffcc', fontSize: 11, letterSpacing: 1.2, fontWeight: '800' },
  invoiceNumber: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 4 },
  total: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 8 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    gap: 12,
  },
  rowLabel: { width: 120, fontSize: 12, fontWeight: '800', color: Brand.muted },
  rowValue: { flex: 1, fontSize: 14, color: Brand.navy, fontWeight: '700' },

  payBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
