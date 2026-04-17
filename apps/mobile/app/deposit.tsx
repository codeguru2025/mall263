import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Brand } from '@/constants/brand';
import {
  initiateMobilePayment,
  initiateWebPayment,
  pollPaymentStatus,
  type MobileMethod,
} from '@/lib/payments-api';

type Mode = 'mobile' | 'web';
type Step = 'form' | 'pending' | 'success' | 'failed';

const METHODS: { key: MobileMethod; label: string; color: string }[] = [
  { key: 'ecocash', label: 'EcoCash', color: '#28A745' },
  { key: 'onemoney', label: 'OneMoney', color: '#E53935' },
  { key: 'telecash', label: 'Telecash', color: '#F7941D' },
];

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 }
    : { elevation: 3 };

export default function DepositScreen() {
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>('mobile');
  const [step, setStep] = useState<Step>('form');

  // form state
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<MobileMethod>('ecocash');
  const [submitting, setSubmitting] = useState(false);

  // pending state
  const [reference, setReference] = useState('');
  const [instructions, setInstructions] = useState('');
  const [failReason, setFailReason] = useState('');

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => clearPoll(), []);

  const startPolling = useCallback(
    (ref: string) => {
      clearPoll();
      pollTimer.current = setInterval(async () => {
        try {
          const result = await pollPaymentStatus(ref);
          if (result.paid) {
            clearPoll();
            await qc.invalidateQueries({ queryKey: ['wallet-balance'] });
            await qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
            setStep('success');
          } else if (['CANCELLED', 'CANCELED', 'FAILED', 'DISPUTED', 'REFUNDED'].includes(result.status)) {
            clearPoll();
            setFailReason(`Payment ${result.status.toLowerCase()}.`);
            setStep('failed');
          }
        } catch {
          // network hiccup — keep polling
        }
      }, 5000);
    },
    [qc],
  );

  const handleSubmitMobile = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) {
      Alert.alert('Invalid amount', 'Minimum deposit is $1.00');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter the mobile money number to charge.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await initiateMobilePayment(amt, phone.trim(), method);
      setReference(result.reference);
      setInstructions(result.instructions);
      setStep('pending');
      startPolling(result.reference);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not initiate payment. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWeb = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) {
      Alert.alert('Invalid amount', 'Minimum deposit is $1.00');
      return;
    }
    setSubmitting(true);
    try {
      const result = await initiateWebPayment(amt);
      setReference(result.reference);
      setInstructions('Complete payment in your browser. This screen will update automatically when done.');
      await Linking.openURL(result.redirectUrl);
      setStep('pending');
      startPolling(result.reference);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not initiate payment. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    clearPoll();
    router.back();
  };

  const handleRetry = () => {
    clearPoll();
    setStep('form');
    setReference('');
    setInstructions('');
    setFailReason('');
  };

  // ── Success ────────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <View style={styles.centered}>
        <View style={[styles.statusCard, cardShadow]}>
          <Text style={styles.statusIcon}>✓</Text>
          <Text style={styles.statusTitle}>Deposit confirmed</Text>
          <Text style={styles.statusSub}>
            ${parseFloat(amount || '0').toFixed(2)} has been added to your wallet.
          </Text>
          <Pressable style={[styles.btn, styles.btnSuccess]} onPress={handleDone}>
            <Text style={styles.btnText}>Back to wallet</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Failed ─────────────────────────────────────────────────────────────────

  if (step === 'failed') {
    return (
      <View style={styles.centered}>
        <View style={[styles.statusCard, cardShadow]}>
          <Text style={[styles.statusIcon, { color: Brand.red }]}>✕</Text>
          <Text style={styles.statusTitle}>Payment failed</Text>
          <Text style={styles.statusSub}>{failReason}</Text>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleRetry}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={handleDone}>
            <Text style={[styles.btnText, { color: Brand.navy }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Pending ────────────────────────────────────────────────────────────────

  if (step === 'pending') {
    return (
      <View style={styles.centered}>
        <View style={[styles.statusCard, cardShadow]}>
          <ActivityIndicator size="large" color={Brand.blue} style={{ marginBottom: 16 }} />
          <Text style={styles.statusTitle}>
            {mode === 'mobile' ? 'Awaiting USSD confirmation' : 'Waiting for payment'}
          </Text>
          <Text style={styles.statusSub}>{instructions}</Text>
          {mode === 'mobile' && (
            <Text style={styles.statusHint}>Enter your PIN on the USSD prompt to approve.</Text>
          )}
          <Text style={styles.statusRef}>Ref: {reference}</Text>
          <Pressable style={[styles.btn, styles.btnGhost, { marginTop: 24 }]} onPress={handleDone}>
            <Text style={[styles.btnText, { color: Brand.navy }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, mode === 'mobile' && styles.modeTabActive]}
          onPress={() => setMode('mobile')}
        >
          <Text style={[styles.modeTabText, mode === 'mobile' && styles.modeTabTextActive]}>
            Mobile Money
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, mode === 'web' && styles.modeTabActive]}
          onPress={() => setMode('web')}
        >
          <Text style={[styles.modeTabText, mode === 'web' && styles.modeTabTextActive]}>
            Card / Zipit
          </Text>
        </Pressable>
      </View>

      <View style={[styles.formCard, cardShadow]}>
        {/* Amount */}
        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 10.00"
          keyboardType="decimal-pad"
          placeholderTextColor={Brand.muted}
        />

        {mode === 'mobile' && (
          <>
            {/* Phone */}
            <Text style={styles.label}>Mobile money number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+263771234567 or 0771234567"
              keyboardType="phone-pad"
              placeholderTextColor={Brand.muted}
            />

            {/* Method */}
            <Text style={styles.label}>Network</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => (
                <Pressable
                  key={m.key}
                  style={[
                    styles.methodBtn,
                    method === m.key && { backgroundColor: m.color, borderColor: m.color },
                  ]}
                  onPress={() => setMethod(m.key)}
                >
                  <Text style={[styles.methodBtnText, method === m.key && { color: '#fff' }]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.hint}>
              You will receive a USSD prompt to approve the payment. Enter your PIN to confirm.
            </Text>
          </>
        )}

        {mode === 'web' && (
          <Text style={styles.hint}>
            You will be taken to the Paynow payment page in your browser to pay by card or Zipit.
            Return to this screen once done — it updates automatically.
          </Text>
        )}

        <Pressable
          style={[styles.btn, styles.btnPrimary, (submitting) && styles.btnDisabled]}
          onPress={mode === 'mobile' ? handleSubmitMobile : handleSubmitWeb}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {mode === 'mobile' ? 'Send USSD prompt' : 'Open payment page'}
            </Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.footNote}>Minimum deposit: $1.00 · Powered by Paynow Zimbabwe</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  scrollContent: { padding: 16, paddingBottom: 40 },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: Brand.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: Brand.card },
  modeTabText: { fontSize: 14, fontWeight: '700', color: Brand.muted },
  modeTabTextActive: { color: Brand.navy },

  formCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.text,
    backgroundColor: Brand.pageBg,
  },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Brand.border,
    alignItems: 'center',
    backgroundColor: Brand.card,
  },
  methodBtnText: { fontSize: 13, fontWeight: '800', color: Brand.navy },
  hint: { fontSize: 12, color: Brand.muted, lineHeight: 18, marginTop: 8 },

  btn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: Brand.blue },
  btnSuccess: { backgroundColor: Brand.green },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Brand.border },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  footNote: { textAlign: 'center', fontSize: 11, color: Brand.muted, marginTop: 16 },

  // status screens
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  statusCard: {
    backgroundColor: Brand.card,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 4,
  },
  statusIcon: { fontSize: 48, color: Brand.green, marginBottom: 8 },
  statusTitle: { fontSize: 20, fontWeight: '900', color: Brand.navy, textAlign: 'center' },
  statusSub: { fontSize: 14, color: Brand.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  statusHint: { fontSize: 13, color: Brand.navy, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  statusRef: { fontSize: 11, color: Brand.muted, marginTop: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
