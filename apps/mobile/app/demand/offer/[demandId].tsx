import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';
import { getApiErrorMessage } from '@/lib/api-errors';
import { fetchDemandById, submitSellerOffer } from '@/lib/demands-api';
import { fetchStallProductsPage, type StallProductRow } from '@/lib/seller-catalog-api';
import { fetchStallsByMerchant } from '@/lib/stalls-api';
import { formatMoney } from '@/lib/products';
import { api } from '@/lib/api';

const SELLER_ROLES = new Set(['STALL_OWNER', 'ATTENDANT']);

type CatalogLine = {
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  maxQty: number;
};

function flattenCatalog(pages: StallProductRow[][]): CatalogLine[] {
  const out: CatalogLine[] = [];
  for (const page of pages) {
    for (const p of page) {
      for (const v of p.variants ?? []) {
        const q = v.inventory?.quantity ?? 0;
        const r = v.inventory?.reservedQty ?? 0;
        const maxQty = Math.max(0, q - r);
        const unit = Number(v.sellingPrice);
        if (!Number.isFinite(unit) || unit <= 0) continue;
        out.push({
          variantId: v.id,
          productName: p.name,
          variantName: v.name,
          unitPrice: unit,
          maxQty,
        });
      }
    }
  }
  return out;
}

export default function SellerOfferScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const raw = useLocalSearchParams<{ demandId: string | string[] }>().demandId;
  const demandId = Array.isArray(raw) ? raw[0] : raw;

  const canSell = user?.role != null && SELLER_ROLES.has(user.role);

  // Subscription gate: sellers on expired trial cannot submit offers
  const subStatusQ = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const { data } = await api.get<{ fullyAccess: boolean; status: string }>('/api/v1/subscriptions/status');
      return data;
    },
    enabled: canSell,
    staleTime: 60_000,
  });
  // Fail closed while loading — prevents a brief unsubscribed window
  const hasSubscriptionAccess = canSell
    ? (subStatusQ.isSuccess ? (subStatusQ.data?.fullyAccess ?? false) : false)
    : true; // non-sellers don't need a subscription check

  const demandQ = useQuery({
    queryKey: ['demand', demandId],
    queryFn: () => fetchDemandById(demandId!),
    enabled: !!demandId,
  });

  const merchantId = user?.merchant?.id;
  const stallsQ = useQuery({
    queryKey: ['stalls-merchant', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  const stallOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; subtitle?: string }>();
    for (const row of user?.attendantStall ?? []) {
      const s = row.stall;
      map.set(s.id, {
        id: s.id,
        name: s.name,
        subtitle: s.stallNumber ? `#${s.stallNumber}` : undefined,
      });
    }
    for (const s of stallsQ.data ?? []) {
      if (!map.has(s.id)) {
        const sub = [s.stallNumber ? `#${s.stallNumber}` : null, s.mall?.name].filter(Boolean).join(' · ');
        map.set(s.id, { id: s.id, name: s.name, subtitle: sub || undefined });
      }
    }
    return [...map.values()];
  }, [user?.attendantStall, stallsQ.data]);

  const [stallId, setStallId] = useState<string | null>(null);
  useEffect(() => {
    if (stallId) return;
    if (stallOptions.length === 1) setStallId(stallOptions[0].id);
  }, [stallId, stallOptions]);

  const productsQ = useInfiniteQuery({
    // Distinct key from the plain-array ['stall-products', id] used by POS/
    // seller screens so the two cache shapes never collide.
    queryKey: ['stall-products-infinite', stallId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchStallProductsPage(stallId!, pageParam as number, 25),
    enabled: !!stallId,
    getNextPageParam: (last) => {
      if (!last || typeof last.page !== 'number' || typeof last.totalPages !== 'number') {
        return undefined;
      }
      return last.page < last.totalPages ? last.page + 1 : undefined;
    },
  });

  const catalogLines = useMemo(
    () => flattenCatalog(productsQ.data?.pages.map((p) => p.data) ?? []),
    [productsQ.data],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => catalogLines.find((l) => l.variantId === selectedId) ?? null,
    [catalogLines, selectedId],
  );

  const [qtyStr, setQtyStr] = useState('1');
  const [unitStr, setUnitStr] = useState('');
  useEffect(() => {
    if (selected) setUnitStr(String(selected.unitPrice));
  }, [selected]);

  const [message, setMessage] = useState('');

  const submitMut = useMutation({
    mutationFn: (payload: {
      demandId: string;
      stallId: string;
      totalPrice: number;
      items: Array<{ variantId: string; quantity: number; price: number }>;
      message?: string;
    }) => {
      const { demandId: dId, ...body } = payload;
      return submitSellerOffer(dId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['open-demands'] });
      Alert.alert('Offer sent', 'The buyer will see your offer on their demand.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: unknown) => {
      Alert.alert('Offer failed', getApiErrorMessage(e, 'Could not submit offer.'));
    },
  });

  const onSubmit = useCallback(() => {
    if (!canSell) {
      Alert.alert('Seller account required', 'Sign in as a stall owner or attendant to submit offers.');
      return;
    }
    if (!hasSubscriptionAccess) {
      Alert.alert(
        'Subscription required',
        'Your trial has ended. Subscribe for $5/month to bid on customer demands.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Subscribe', onPress: () => router.push('/subscriptions' as never) },
        ],
      );
      return;
    }
    if (!stallId) {
      Alert.alert('Stall', 'Select a stall.');
      return;
    }
    if (!selected) {
      Alert.alert('Product', 'Choose a catalog line.');
      return;
    }
    const qty = parseInt(qtyStr, 10);
    const unit = parseFloat(unitStr.replace(/,/g, ''));
    if (!Number.isFinite(qty) || qty < 1) {
      Alert.alert('Quantity', 'Enter a whole number of at least 1.');
      return;
    }
    if (!Number.isFinite(unit) || unit < 0.01) {
      Alert.alert('Price', 'Unit price must be at least 0.01.');
      return;
    }
    if (selected.maxQty > 0 && qty > selected.maxQty) {
      Alert.alert('Stock', `Only ${selected.maxQty} available for this variant.`);
      return;
    }
    const totalPrice = Math.round(qty * unit * 100) / 100;
    submitMut.mutate({
      demandId: demandId!,
      stallId,
      totalPrice,
      message: message.trim() || undefined,
      items: [{ variantId: selected.variantId, quantity: qty, price: unit }],
    });
  }, [canSell, hasSubscriptionAccess, demandId, message, qtyStr, selected, stallId, submitMut, unitStr, router]);

  const loadMore = useCallback(() => {
    if (productsQ.hasNextPage && !productsQ.isFetchingNextPage) productsQ.fetchNextPage();
  }, [productsQ]);

  const cur = demandQ.data?.currency ?? 'USD';

  if (!demandId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing demand.</Text>
      </View>
    );
  }

  if (demandQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.demandTitle}>{demandQ.data?.title ?? 'Demand'}</Text>
        {!canSell ? (
          <Text style={styles.warn}>You are signed in as {user?.role?.replace(/_/g, ' ') ?? 'this user'}. Use a stall
            owner or attendant account to submit an offer.</Text>
        ) : null}

        <Text style={styles.section}>Your stall</Text>
        {stallOptions.length === 0 ? (
          <Text style={styles.muted}>
            No stall linked to this profile. Create a stall on the web as a merchant, or ask to be added as an
            attendant.
          </Text>
        ) : (
          <View style={styles.chipRow}>
            {stallOptions.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.chip, stallId === s.id && styles.chipOn]}
                onPress={() => {
                  setStallId(s.id);
                  setSelectedId(null);
                }}
              >
                <Text style={[styles.chipText, stallId === s.id && styles.chipTextOn]} numberOfLines={1}>
                  {s.name}
                  {s.subtitle ? ` ${s.subtitle}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {stallId ? (
          <>
            <Text style={styles.section}>Pick a catalog line</Text>
            {productsQ.isPending ? (
              <ActivityIndicator color={Brand.blue} style={{ marginVertical: 12 }} />
            ) : catalogLines.length === 0 ? (
              <Text style={styles.muted}>No priced variants in this stall. Add products on the web.</Text>
            ) : (
              <>
                {catalogLines.slice(0, 80).map((item) => (
                  <Pressable
                    key={item.variantId}
                    style={[styles.lineRow, selectedId === item.variantId && styles.lineRowOn]}
                    onPress={() => setSelectedId(item.variantId)}
                  >
                    <Text style={styles.lineTitle} numberOfLines={2}>
                      {item.productName} — {item.variantName}
                    </Text>
                    <Text style={styles.lineMeta}>
                      {formatMoney(item.unitPrice, cur)} · stock {item.maxQty}
                    </Text>
                  </Pressable>
                ))}
                {catalogLines.length > 80 ? (
                  <Text style={styles.muted}>Showing first 80 lines. Narrow with web catalog if needed.</Text>
                ) : null}
                {productsQ.hasNextPage ? (
                  <Pressable style={styles.loadMore} onPress={loadMore} disabled={productsQ.isFetchingNextPage}>
                    <Text style={styles.loadMoreText}>
                      {productsQ.isFetchingNextPage ? 'Loading…' : 'Load more catalog'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}

            {selected ? (
              <>
                <Text style={styles.section}>Offer details</Text>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={qtyStr}
                  onChangeText={setQtyStr}
                  keyboardType="number-pad"
                  placeholder="1"
                />
                <Text style={styles.label}>Unit price (USD)</Text>
                <TextInput
                  style={styles.input}
                  value={unitStr}
                  onChangeText={setUnitStr}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Message to buyer (optional)</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Condition, pickup time…"
                  multiline
                />
                <Text style={styles.total}>
                  Offer total:{' '}
                  {formatMoney(
                    (() => {
                      const q = parseInt(qtyStr, 10) || 0;
                      const u = parseFloat(unitStr.replace(/,/g, '')) || 0;
                      return Math.round(q * u * 100) / 100;
                    })(),
                    cur,
                  )}
                </Text>
                <Pressable
                  style={[styles.submit, (!canSell || submitMut.isPending) && styles.submitOff]}
                  onPress={onSubmit}
                  disabled={!canSell || submitMut.isPending}
                >
                  {submitMut.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Submit offer</Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg },
  demandTitle: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 10 },
  warn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    color: '#9a3412',
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  section: { fontSize: 14, fontWeight: '800', color: Brand.navy, marginTop: 12, marginBottom: 8 },
  muted: { fontSize: 14, color: Brand.muted, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
    maxWidth: '100%',
  },
  chipOn: { borderColor: Brand.blue, backgroundColor: Brand.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  chipTextOn: { color: '#fff' },
  lineRow: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 8,
    backgroundColor: Brand.card,
  },
  lineRowOn: { borderColor: Brand.blue, borderWidth: 2 },
  lineTitle: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  lineMeta: { fontSize: 13, color: Brand.muted, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: Brand.card,
    color: Brand.text,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  total: { fontSize: 16, fontWeight: '800', color: Brand.blue, marginBottom: 14 },
  submit: { backgroundColor: Brand.blue, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitOff: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { color: Brand.red, fontWeight: '700' },
  loadMore: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.blue,
  },
  loadMoreText: { color: Brand.blue, fontWeight: '800', fontSize: 14 },
});
