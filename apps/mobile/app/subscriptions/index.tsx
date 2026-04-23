import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  fetchSubscriptionPlans,
  fetchSubscriptionStatus,
  initiateSubscriptionPayment,
  pollSubscriptionPayment,
  validatePromoCode,
  type SubscriptionPlan,
} from '@/lib/subscriptions-api';
import { Brand } from '@/constants/brand';

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function formatMoney(value: unknown, currency = 'USD') {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return null;
  }
}

export default function SubscriptionsScreen() {
  const qc = useQueryClient();
  const [promo, setPromo] = useState('');
  const [polling, setPolling] = useState(false);
  const debouncedPromo = useDebounced(promo, 600);

  const promoValidQ = useQuery({
    queryKey: ['promo-validate', debouncedPromo],
    queryFn: () => validatePromoCode(debouncedPromo.trim()),
    enabled: debouncedPromo.trim().length >= 3,
    retry: false,
    staleTime: 30_000,
  });

  const statusQ = useQuery({
    queryKey: ['subscription-status'],
    queryFn: fetchSubscriptionStatus,
    retry: 1,
  });

  const plansQ = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: fetchSubscriptionPlans,
  });

  const payMut = useMutation({
    mutationFn: () => initiateSubscriptionPayment(promo.trim() || undefined),
    onSuccess: async (res) => {
      if (res.redirectUrl) {
        const ok = await Linking.canOpenURL(res.redirectUrl);
        if (ok) await Linking.openURL(res.redirectUrl);
      }
      if (res.reference) {
        setPolling(true);
        try {
          // Poll a few times to pick up completion; bail after ~1 minute.
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const s = await pollSubscriptionPayment(res.reference);
            if (s.paid || s.status === 'PAID' || s.status === 'COMPLETED') {
              break;
            }
          }
        } catch {
          /* ignore polling errors */
        } finally {
          setPolling(false);
          qc.invalidateQueries({ queryKey: ['subscription-status'] });
        }
      } else {
        qc.invalidateQueries({ queryKey: ['subscription-status'] });
      }
    },
    onError: (err) => {
      let msg = 'Could not start payment.';
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Error', msg);
    },
  });

  const status = statusQ.data;
  const plans = plansQ.data ?? [];
  const currentPlanId = status?.plan?.id;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Your subscription</Text>
          {statusQ.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.statusTier}>
                {status?.plan?.name ?? status?.tier ?? 'Free'}
              </Text>
              <View style={styles.statusRow}>
                {status?.isActive ? (
                  <View style={[styles.badge, styles.badgeActive]}>
                    <FontAwesome name="check-circle" size={11} color="#16a34a" />
                    <Text style={[styles.badgeText, { color: '#16a34a' }]}>Active</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeInactive]}>
                    <FontAwesome name="clock-o" size={11} color="#ea580c" />
                    <Text style={[styles.badgeText, { color: '#ea580c' }]}>
                      {status?.status ?? 'Inactive'}
                    </Text>
                  </View>
                )}
                {formatDate(status?.currentPeriodEnd) ? (
                  <Text style={styles.statusMeta}>Renews {formatDate(status?.currentPeriodEnd)}</Text>
                ) : formatDate(status?.trialEndsAt) ? (
                  <Text style={styles.statusMeta}>Trial ends {formatDate(status?.trialEndsAt)}</Text>
                ) : null}
              </View>
            </>
          )}
        </View>

        {/* Plans */}
        <Text style={styles.sectionTitle}>Plans</Text>
        {plansQ.isPending ? (
          <ActivityIndicator color={Brand.blue} style={{ marginTop: 16 }} />
        ) : plans.length === 0 ? (
          <Text style={styles.emptyPlans}>No plans available yet.</Text>
        ) : (
          plans.map((plan) => <PlanCard key={plan.id} plan={plan} isCurrent={plan.id === currentPlanId} />)
        )}

        {/* Pay */}
        <View style={styles.payCard}>
          <Text style={styles.label}>Promo code (optional)</Text>
          <TextInput
            style={[
              styles.input,
              promoValidQ.data?.valid === true && styles.inputValid,
              promoValidQ.data?.valid === false && styles.inputInvalid,
            ]}
            value={promo}
            onChangeText={(v: string) => setPromo(v.toUpperCase())}
            placeholder="Enter promo or referral code"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            editable={!payMut.isPending}
          />
          {/* Promo validation feedback */}
          {promo.trim().length >= 3 && (
            <View style={styles.promoFeedbackRow}>
              {promoValidQ.isFetching ? (
                <>
                  <ActivityIndicator size="small" color={Brand.blue} />
                  <Text style={styles.promoChecking}>Checking code...</Text>
                </>
              ) : promoValidQ.data?.valid === true ? (
                <>
                  <FontAwesome name="check-circle" size={14} color="#16a34a" />
                  <Text style={styles.promoValid}>
                    {promoValidQ.data.discount
                      ? `${promoValidQ.data.discount}% off`
                      : promoValidQ.data.months
                      ? `+${promoValidQ.data.months} free month${promoValidQ.data.months > 1 ? 's' : ''}`
                      : 'Valid code!'}
                    {promoValidQ.data.message ? ` — ${promoValidQ.data.message}` : ''}
                  </Text>
                </>
              ) : promoValidQ.data?.valid === false ? (
                <>
                  <FontAwesome name="times-circle" size={14} color={Brand.red} />
                  <Text style={styles.promoInvalid}>{promoValidQ.data.message ?? 'Invalid code'}</Text>
                </>
              ) : null}
            </View>
          )}

          <Pressable
            style={[styles.payBtn, (payMut.isPending || polling) && styles.payBtnDisabled]}
            onPress={() => payMut.mutate()}
            disabled={payMut.isPending || polling}
          >
            {payMut.isPending || polling ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.payBtnText}>{polling ? 'Checking payment…' : 'Starting payment…'}</Text>
              </>
            ) : (
              <>
                <FontAwesome name="credit-card" size={14} color="#fff" />
                <Text style={styles.payBtnText}>Pay subscription</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.helper}>
            You&apos;ll be redirected to our payment gateway. Once complete, return here to see your
            subscription activate.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PlanCard({ plan, isCurrent }: { plan: SubscriptionPlan; isCurrent: boolean }) {
  return (
    <View style={[styles.planCard, isCurrent && styles.planCardActive]}>
      <View style={styles.planHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{plan.name}</Text>
          {plan.description ? <Text style={styles.planDesc}>{plan.description}</Text> : null}
        </View>
        {isCurrent ? (
          <View style={styles.currentPill}>
            <Text style={styles.currentPillText}>Current</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.planPrice}>
        {formatMoney(plan.price, plan.currency ?? 'USD')}
        {plan.billingPeriod ? <Text style={styles.planPeriod}> / {plan.billingPeriod.toLowerCase()}</Text> : null}
      </Text>
      {plan.features && plan.features.length > 0 ? (
        <View style={styles.features}>
          {plan.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <FontAwesome name="check" size={11} color="#16a34a" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 14, paddingBottom: 40 },

  statusCard: {
    backgroundColor: Brand.navy,
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
  },
  statusLabel: {
    color: '#ffffff99',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusTier: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6, letterSpacing: -0.4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeActive: { backgroundColor: '#ecfdf5' },
  badgeInactive: { backgroundColor: '#fff7ed' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  statusMeta: { color: '#ffffffcc', fontSize: 12 },

  sectionTitle: { fontSize: 13, fontWeight: '900', color: Brand.navy, marginBottom: 10, marginLeft: 2 },

  planCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Brand.border,
    marginBottom: 10,
  },
  planCardActive: { borderColor: Brand.blue },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 16, fontWeight: '900', color: Brand.navy, letterSpacing: -0.2 },
  planDesc: { fontSize: 12, color: Brand.muted, marginTop: 3 },
  currentPill: {
    backgroundColor: Brand.blue,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  currentPillText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  planPrice: { marginTop: 8, fontSize: 22, fontWeight: '900', color: Brand.blue, letterSpacing: -0.3 },
  planPeriod: { fontSize: 12, fontWeight: '700', color: Brand.muted },
  features: { marginTop: 12, gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: Brand.text },

  emptyPlans: { textAlign: 'center', color: Brand.muted, marginVertical: 18, fontSize: 13 },

  payCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginTop: 10,
  },
  label: { fontSize: 12, fontWeight: '800', color: Brand.navy, marginBottom: 6 },
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
  payBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  helper: { fontSize: 11, color: Brand.muted, marginTop: 10, lineHeight: 16 },
  inputValid: { borderColor: '#16a34a', borderWidth: 1.5 },
  inputInvalid: { borderColor: Brand.red, borderWidth: 1.5 },
  promoFeedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  promoChecking: { fontSize: 12, color: Brand.muted },
  promoValid: { fontSize: 12, color: '#16a34a', fontWeight: '700', flex: 1 },
  promoInvalid: { fontSize: 12, color: Brand.red, fontWeight: '700', flex: 1 },
});
