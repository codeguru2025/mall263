import React, { useState } from 'react';
import {
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
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, router } from 'expo-router';
import { Brand } from '@/constants/brand';
import { formatMoney } from '@/lib/products';
import { api } from '@/lib/api';

type Stage = 'enter-phone' | 'waiting' | 'confirming' | 'done';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#1B2A4A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 12 }
    : { elevation: 3 };

function buildUssdUrl(network: 'ECOCASH' | 'ONEMONEY', customerPhone: string, merchantCode: string, amount: number) {
  const clean = customerPhone.replace(/\D/g, '').replace(/^263/, '0').replace(/^0/, '0');
  const amt = amount.toFixed(2);
  // EcoCash merchant push: *151*2*<customerNumber>*<amount>*<merchantCode>#
  // OneMoney merchant push: *111*2*<customerNumber>*<amount>*<merchantCode>#
  const ussd = network === 'ECOCASH'
    ? `*151*2*${clean}*${amt}*${merchantCode}#`
    : `*111*2*${clean}*${amt}*${merchantCode}#`;
  return `tel:${encodeURIComponent(ussd)}`;
}

export default function MerchantPayScreen() {
  const params = useLocalSearchParams<{
    reference: string;
    totalAmount: string;
    merchantCode: string;
    network: string;
  }>();

  const reference = params.reference ?? '';
  const totalAmount = parseFloat(params.totalAmount ?? '0');
  const merchantCode = params.merchantCode ?? '';
  const network = (params.network ?? 'ECOCASH') as 'ECOCASH' | 'ONEMONEY';
  const networkLabel = network === 'ECOCASH' ? 'EcoCash' : 'OneMoney';

  const [stage, setStage] = useState<Stage>('enter-phone');
  const [phone, setPhone] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);

  const networkColor = network === 'ECOCASH' ? '#28A745' : '#E53935';

  function handleDial() {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 9) {
      Alert.alert('Invalid number', `Enter a valid ${networkLabel} number`);
      return;
    }
    const url = buildUssdUrl(network, cleaned, merchantCode, totalAmount);
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not dial', 'Please ensure your device supports USSD calls.');
    });
    setStage('waiting');
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await api.post(`/api/v1/pos/merchant-payment/confirm/${reference}`);
      setSaleId(res.data?.sale?.id ?? null);
      setStage('done');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not confirm. Try again.');
    } finally {
      setConfirming(false);
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <View style={styles.centered}>
        <FontAwesome name="check-circle" size={64} color="#43A047" style={{ marginBottom: 12 }} />
        <Text style={styles.doneTitle}>Payment confirmed</Text>
        <Text style={styles.doneAmount}>{formatMoney(totalAmount, 'USD')}</Text>
        <Text style={styles.doneSub}>via {networkLabel}</Text>
        <Pressable
          style={[styles.primaryBtn, { marginTop: 36 }]}
          onPress={() =>
            saleId
              ? router.replace(`/pos/receipt/${saleId}` as any)
              : router.replace('/pos/cart' as any)
          }
        >
          <FontAwesome name="file-text-o" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>{saleId ? 'View receipt' : 'Back to POS'}</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => router.replace('/pos/cart' as any)}>
          <Text style={styles.ghostBtnText}>New sale</Text>
        </Pressable>
      </View>
    );
  }

  // ── Waiting for PIN ───────────────────────────────────────────────────────
  if (stage === 'waiting') {
    return (
      <View style={styles.centered}>
        <View style={[styles.networkPill, { backgroundColor: `${networkColor}18`, borderColor: networkColor }]}>
          <FontAwesome name="mobile" size={16} color={networkColor} />
          <Text style={[styles.networkPillText, { color: networkColor }]}>{networkLabel}</Text>
        </View>

        <Text style={styles.waitAmount}>{formatMoney(totalAmount, 'USD')}</Text>
        <Text style={styles.waitTitle}>Waiting for customer</Text>
        <Text style={styles.waitSub}>
          A payment request has been sent to the customer's phone.{'\n'}
          Ask them to approve it with their PIN.
        </Text>

        <Pressable
          style={[styles.primaryBtn, { marginTop: 40 }, confirming && styles.disabled]}
          onPress={handleConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome name="check" size={15} color="#fff" />
              <Text style={styles.primaryBtnText}>Payment received — confirm</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </Pressable>

        <Pressable style={styles.redialBtn} onPress={handleDial}>
          <FontAwesome name="refresh" size={13} color={Brand.blue} />
          <Text style={styles.redialText}>Resend request</Text>
        </Pressable>
      </View>
    );
  }

  // ── Enter phone ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Amount card */}
        <View style={[styles.amountCard, cardShadow]}>
          <View style={[styles.networkPill, { backgroundColor: `${networkColor}18`, borderColor: networkColor, alignSelf: 'flex-start' }]}>
            <FontAwesome name="mobile" size={14} color={networkColor} />
            <Text style={[styles.networkPillText, { color: networkColor }]}>{networkLabel} Merchant</Text>
          </View>
          <Text style={styles.amountLabel}>Amount to collect</Text>
          <Text style={styles.amount}>{formatMoney(totalAmount, 'USD')}</Text>
        </View>

        {/* Phone input */}
        <View style={[styles.inputCard, cardShadow]}>
          <Text style={styles.inputLabel}>Customer's {networkLabel} number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0771234567"
            placeholderTextColor={Brand.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={13}
            returnKeyType="done"
            autoFocus
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, !phone.trim() && styles.disabled]}
          onPress={handleDial}
          disabled={!phone.trim()}
        >
          <FontAwesome name="paper-plane" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>Request {formatMoney(totalAmount, 'USD')}</Text>
        </Pressable>

        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 20, paddingBottom: 48, gap: 16 },

  amountCard: {
    backgroundColor: Brand.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 8,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  networkPillText: { fontSize: 12, fontWeight: '800' },
  amountLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  amount: { fontSize: 40, fontWeight: '900', color: Brand.orange, letterSpacing: -1 },

  inputCard: {
    backgroundColor: Brand.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 10,
  },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  input: {
    backgroundColor: Brand.pageBg,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '700',
    color: Brand.navy,
    letterSpacing: 2,
  },

  primaryBtn: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.5 },

  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  ghostBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Brand.pageBg,
    gap: 10,
  },
  waitAmount: { fontSize: 44, fontWeight: '900', color: Brand.orange, letterSpacing: -1 },
  waitTitle: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginTop: 4 },
  waitSub: { fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  doneTitle: { fontSize: 24, fontWeight: '900', color: Brand.navy },
  doneAmount: { fontSize: 44, fontWeight: '900', color: Brand.orange, letterSpacing: -1 },
  doneSub: { fontSize: 14, color: Brand.muted },

  redialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  redialText: { fontSize: 13, color: Brand.blue, fontWeight: '700' },
});
