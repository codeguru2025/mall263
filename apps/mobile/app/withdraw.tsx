import { useState, useEffect } from 'react';
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
import axios from 'axios';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchWalletBalance, requestWalletWithdrawal } from '@/lib/wallet-api';
import { formatMoney } from '@/lib/products';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffHomePath, isStaffAdminRole } from '@mall263/shared';

export default function WithdrawScreen() {
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
    else if (user && isStaffAdminRole(user.role)) {
      router.replace((getStaffHomePath(user.role) ?? '/admin') as never);
    }
  }, [isAuthenticated, user]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const balanceQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: fetchWalletBalance,
    enabled: isAuthenticated && !isStaffAdminRole(user?.role),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const n = parseFloat(amount);
      if (!Number.isFinite(n) || n <= 0) {
        return Promise.reject(new Error('Enter a valid amount.'));
      }
      return requestWalletWithdrawal(n, description);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      Alert.alert(
        'Withdrawal requested',
        'Your request is pending review. Funds are locked until it is processed.',
        [{ text: 'Back to wallet', onPress: () => router.back() }],
      );
    },
    onError: (err) => {
      let msg = 'Could not submit withdrawal.';
      if (err instanceof Error && err.message) msg = err.message;
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Error', msg);
    },
  });

  const currency = balanceQ.data?.currency ?? 'USD';
  const available = balanceQ.data?.available ?? 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceAmount}>{formatMoney(available, currency)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Amount to withdraw</Text>
          <View style={styles.amountRow}>
            <View style={styles.currencyPrefix}>
              <Text style={styles.currencyPrefixText}>{currency}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              editable={!mutation.isPending}
            />
          </View>

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. bank withdrawal, mobile money cash-out"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            editable={!mutation.isPending}
          />

          <View style={styles.infoBox}>
            <FontAwesome name="info-circle" size={13} color={Brand.blue} />
            <Text style={styles.infoText}>
              Withdrawals are reviewed within 24 hours. The amount is held from your available balance until processed.
            </Text>
          </View>

          <Pressable
            style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="paper-plane" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Submit request</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 14, gap: 12, paddingBottom: 40 },

  balanceCard: {
    backgroundColor: Brand.navy,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#ffffffaa',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceAmount: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.6, marginTop: 6 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },

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
    marginBottom: 8,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  amountRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 8 },
  currencyPrefix: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#eff6fc',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: Brand.border,
  },
  currencyPrefixText: { color: Brand.blue, fontWeight: '900', fontSize: 12 },
  amountInput: {
    flex: 1,
    marginBottom: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    fontSize: 18,
    fontWeight: '800',
  },

  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#eff6fc',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 14,
  },
  infoText: { flex: 1, fontSize: 12, color: Brand.navy, lineHeight: 17 },

  submitBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
