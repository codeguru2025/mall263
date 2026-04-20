import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, router } from 'expo-router';
import { Brand } from '@/constants/brand';
import { formatMoney } from '@/lib/products';
import { pollMerchantPayment } from '@/lib/merchant-pay-api';

const MAX_POLLS = 40;    // 40 × 3 s = 120 s timeout
const POLL_INTERVAL = 3000;

type Stage = 'polling' | 'success' | 'failed';

export default function MerchantPayScreen() {
  const params = useLocalSearchParams<{
    reference: string;
    totalAmount: string;
    network: string;
  }>();

  const reference = params.reference ?? '';
  const totalAmount = parseFloat(params.totalAmount ?? '0');
  const network = (params.network ?? 'ECOCASH') as 'ECOCASH' | 'ONEMONEY';
  const networkLabel = network === 'ECOCASH' ? 'EcoCash' : 'OneMoney';

  const [stage, setStage] = useState<Stage>('polling');
  const [failMessage, setFailMessage] = useState('');
  const [saleId, setSaleId] = useState<string | null>(null);

  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    // Validate reference before starting poll cycle
    if (!reference || reference.length < 6) {
      setFailMessage('Invalid payment reference.');
      setStage('failed');
      return;
    }

    async function poll() {
      if (stopped.current || !isMounted.current) return;

      try {
        const result = await pollMerchantPayment(reference);

        if (!isMounted.current) return;

        if (result.paid) {
          stopped.current = true;
          setSaleId(result.sale?.id ?? null);
          setStage('success');
          return;
        }

        // Terminal status from the payment network
        if (
          result.status === 'FAILED' ||
          result.status === 'CANCELLED' ||
          result.status === 'DECLINED'
        ) {
          stopped.current = true;
          setFailMessage('Transaction failed. Payment was declined.');
          setStage('failed');
          return;
        }
      } catch (e: any) {
        if (!isMounted.current) return;

        const status: number = e?.response?.status ?? 0;
        const msg: string = (e?.response?.data?.message ?? '').toLowerCase();

        // 403 / 404 — terminal, do not retry
        if (status === 403 || status === 404) {
          stopped.current = true;
          setFailMessage('Payment request not found.');
          setStage('failed');
          return;
        }

        // 400 or explicit failure keywords — terminal
        if (status === 400 || msg.includes('insufficient') || msg.includes('failed') || msg.includes('declined')) {
          stopped.current = true;
          setFailMessage('Transaction failed. Insufficient funds or payment declined.');
          setStage('failed');
          return;
        }
        // 5xx / network error — keep retrying
      }

      if (!isMounted.current) return;

      attempts.current += 1;
      if (attempts.current >= MAX_POLLS) {
        stopped.current = true;
        setFailMessage('Payment timed out. Please try again.');
        setStage('failed');
        return;
      }

      timer.current = setTimeout(poll, POLL_INTERVAL);
    }

    // Short initial delay so the network push has time to reach the customer
    timer.current = setTimeout(poll, 2000);

    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reference]);

  // ── Success ─────────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <View style={styles.page}>
        <FontAwesome name="check-circle" size={64} color={Brand.green} />
        <Text style={styles.successAmount}>{formatMoney(totalAmount, 'USD')}</Text>
        <Text style={styles.successLabel}>Payment received</Text>
        <Pressable
          style={[styles.primaryBtn, { marginTop: 40 }]}
          onPress={() =>
            saleId
              ? router.replace({ pathname: '/pos/receipt/[saleId]', params: { saleId } })
              : router.replace('/pos' as any)
          }
        >
          <Text style={styles.primaryBtnText}>{saleId ? 'View Receipt' : 'Back to POS'}</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => router.replace('/pos/cart' as any)}>
          <Text style={styles.ghostBtnText}>New Sale</Text>
        </Pressable>
      </View>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────────────────
  if (stage === 'failed') {
    return (
      <View style={styles.page}>
        <View style={styles.failIcon}>
          <FontAwesome name="times-circle" size={56} color={Brand.red} />
        </View>
        <Text style={styles.failTitle}>Transaction Failed</Text>
        <Text style={styles.failSub}>{failMessage}</Text>
        <Pressable style={[styles.primaryBtn, { marginTop: 36 }]} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Polling ──────────────────────────────────────────────────────────────────
  const networkColor = network === 'ECOCASH' ? '#28A745' : '#E53935';

  return (
    <View style={styles.page}>
      <View style={[styles.networkBadge, { borderColor: networkColor, backgroundColor: `${networkColor}18` }]}>
        <FontAwesome name="mobile" size={14} color={networkColor} />
        <Text style={[styles.networkText, { color: networkColor }]}>{networkLabel}</Text>
      </View>

      <Text style={styles.pollAmount}>{formatMoney(totalAmount, 'USD')}</Text>

      <ActivityIndicator
        size={Platform.OS === 'ios' ? 'large' : 48}
        color={Brand.blue}
        style={{ marginTop: 24, marginBottom: 24 }}
      />

      <Text style={styles.pollLabel}>Waiting for payment</Text>
      <Text style={styles.pollSub}>The customer will be prompted to enter their PIN.</Text>

      <Pressable style={[styles.ghostBtn, { marginTop: 48 }]} onPress={() => router.back()}>
        <Text style={styles.ghostBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },

  networkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 8,
  },
  networkText: { fontSize: 13, fontWeight: '800' },

  pollAmount: { fontSize: 44, fontWeight: '900', color: Brand.orange, letterSpacing: -1 },
  pollLabel: { fontSize: 20, fontWeight: '900', color: Brand.navy },
  pollSub: { fontSize: 13, color: Brand.muted, textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  successAmount: { fontSize: 48, fontWeight: '900', color: Brand.orange, letterSpacing: -1, marginTop: 12 },
  successLabel: { fontSize: 18, fontWeight: '700', color: Brand.navy },

  failIcon: { marginBottom: 4 },
  failTitle: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginTop: 8 },
  failSub: { fontSize: 13, color: Brand.muted, textAlign: 'center', lineHeight: 20, maxWidth: 260, marginTop: 4 },

  primaryBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 16, paddingVertical: 17,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  ghostBtn: {
    paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 14, borderWidth: 1.5, borderColor: Brand.border,
    alignItems: 'center',
  },
  ghostBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },
});
