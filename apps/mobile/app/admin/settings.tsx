import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS'];

const FLAGS = [
  { key: 'ENABLE_DELIVERY_LAYER', label: 'Delivery Layer', desc: 'Master switch for job creation & driver matching' },
  { key: 'ENABLE_SAFE_PAY_ESCROW', label: 'SafePay Escrow', desc: 'Lock buyer funds until delivery is confirmed' },
  { key: 'ENABLE_COD_SYSTEM', label: 'Cash on Delivery', desc: 'Allow drivers to collect cash and remit later' },
  { key: 'ENABLE_DIRECT_DEAL', label: 'Direct Deal', desc: 'Buyer and seller meet without platform involvement' },
  { key: 'ENABLE_RISK_RESERVES', label: 'Risk Reserves', desc: '2% of item value split to platform risk pool' },
  { key: 'ENABLE_DRIVER_FLOAT_SYSTEM', label: 'Driver Float', desc: 'Hold a % of driver earnings as a float buffer' },
  { key: 'VIRTUAL_STORE_WALK', label: 'Virtual Store Walk', desc: 'Allow merchants to upload aisle walk videos' },
];

export default function AdminSettingsScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Rate state
  const [deliveryRate, setDeliveryRate] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [deliveryFeeRate, setDeliveryFeeRate] = useState('');
  const [agentCommission, setAgentCommission] = useState('');
  const [boostP7, setBoostP7] = useState('');
  const [boostP14, setBoostP14] = useState('');
  const [boostP30, setBoostP30] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const settingsQ = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<Record<string, string>>('/api/v1/admin/settings').then((r) => r.data),
    enabled: isAuthenticated,
  });
  const s = settingsQ.data;

  useEffect(() => {
    if (!s) return;
    if (s.delivery_rate_per_km) setDeliveryRate(s.delivery_rate_per_km);
    if (s.platform_commission_rate) setCommissionRate(String((parseFloat(s.platform_commission_rate) * 100).toFixed(1)));
    if (s.delivery_platform_fee_rate) setDeliveryFeeRate(String((parseFloat(s.delivery_platform_fee_rate) * 100).toFixed(1)));
    if (s.agent_commission_rate) setAgentCommission(String((parseFloat(s.agent_commission_rate) * 100).toFixed(1)));
    if (s.product_boost_price_7) setBoostP7(s.product_boost_price_7);
    if (s.product_boost_price_14) setBoostP14(s.product_boost_price_14);
    if (s.product_boost_price_30) setBoostP30(s.product_boost_price_30);
  }, [s]);

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.post(`/api/v1/admin/settings/${key}`, { value }).then((r) => r.data),
    onSuccess: () => {
      Alert.alert('Saved', 'Setting updated.');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'Failed to save.'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await settingsQ.refetch(); } finally { setRefreshing(false); }
  }, [settingsQ]);

  function saveRate(key: string, value: string, multiplier = 1, min = 0, max = 100, label = 'Value') {
    const v = parseFloat(value);
    if (isNaN(v) || v < min || v > max) { Alert.alert('Invalid', `${label} must be between ${min} and ${max}`); return; }
    saveSetting.mutate({ key, value: (v * multiplier).toFixed(4) });
  }

  function savePrice(key: string, value: string) {
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) { Alert.alert('Invalid', 'Enter a positive price'); return; }
    saveSetting.mutate({ key, value: v.toFixed(2) });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
      >
        <Text style={styles.heading}>App Settings</Text>

        {settingsQ.isPending ? (
          <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
        ) : (
          <>
            {/* ── Delivery Pricing ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🚚 Delivery Pricing</Text>
              <Text style={styles.desc}>Rate per km charged to buyer</Text>
              <TextInput
                style={styles.input}
                value={deliveryRate}
                onChangeText={setDeliveryRate}
                keyboardType="decimal-pad"
                placeholder="0.50"
                placeholderTextColor={Brand.muted}
              />
              <Pressable
                style={[styles.btn, styles.primaryBtn, saveSetting.isPending && styles.btnDisabled]}
                onPress={() => {
                  const v = parseFloat(deliveryRate);
                  if (isNaN(v) || v < 0) { Alert.alert('Invalid', 'Enter a valid rate'); return; }
                  saveSetting.mutate({ key: 'delivery_rate_per_km', value: v.toFixed(2) });
                }}
                disabled={saveSetting.isPending}
              >
                <Text style={styles.btnText}>Save Delivery Rate</Text>
              </Pressable>
            </View>

            {/* ── Commission Rates ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Platform Rates</Text>

              <Text style={styles.fieldLabel}>Sales Commission (%)</Text>
              <Text style={styles.fieldDesc}>Deducted from seller on each POS sale. Currently {s?.platform_commission_rate ? `${(parseFloat(s.platform_commission_rate) * 100).toFixed(1)}%` : '2.5%'}</Text>
              <TextInput style={styles.input} value={commissionRate} onChangeText={setCommissionRate} keyboardType="decimal-pad" placeholder="2.5" placeholderTextColor={Brand.muted} />
              <Pressable style={[styles.btn, styles.primaryBtn, saveSetting.isPending && styles.btnDisabled]} onPress={() => saveRate('platform_commission_rate', commissionRate, 0.01, 0, 50, 'Commission')} disabled={saveSetting.isPending}>
                <Text style={styles.btnText}>Save Commission Rate</Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Delivery Platform Fee (%)</Text>
              <Text style={styles.fieldDesc}>Cut taken on each delivery job item amount. Currently {s?.delivery_platform_fee_rate ? `${(parseFloat(s.delivery_platform_fee_rate) * 100).toFixed(1)}%` : '3%'}</Text>
              <TextInput style={styles.input} value={deliveryFeeRate} onChangeText={setDeliveryFeeRate} keyboardType="decimal-pad" placeholder="3" placeholderTextColor={Brand.muted} />
              <Pressable style={[styles.btn, styles.primaryBtn, saveSetting.isPending && styles.btnDisabled]} onPress={() => saveRate('delivery_platform_fee_rate', deliveryFeeRate, 0.01, 0, 20, 'Fee')} disabled={saveSetting.isPending}>
                <Text style={styles.btnText}>Save Delivery Fee Rate</Text>
              </Pressable>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Agent Subscription Commission (%)</Text>
              <Text style={styles.fieldDesc}>Credited to agent when their merchant pays a subscription. Currently {s?.agent_commission_rate ? `${(parseFloat(s.agent_commission_rate) * 100).toFixed(1)}%` : '10%'}</Text>
              <TextInput style={styles.input} value={agentCommission} onChangeText={setAgentCommission} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={Brand.muted} />
              <Pressable style={[styles.btn, styles.primaryBtn, saveSetting.isPending && styles.btnDisabled]} onPress={() => saveRate('agent_commission_rate', agentCommission, 0.01, 0, 50, 'Agent commission')} disabled={saveSetting.isPending}>
                <Text style={styles.btnText}>Save Agent Commission</Text>
              </Pressable>
            </View>

            {/* ── Boost Prices ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Product Boost Prices (USD)</Text>
              {[
                { label: '7 days', key: 'product_boost_price_7', val: boostP7, set: setBoostP7 },
                { label: '14 days', key: 'product_boost_price_14', val: boostP14, set: setBoostP14 },
                { label: '30 days', key: 'product_boost_price_30', val: boostP30, set: setBoostP30 },
              ].map(({ label, key, val, set }) => (
                <View key={key} style={styles.inlineRow}>
                  <Text style={styles.inlineLabel}>{label}</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={val}
                    onChangeText={set}
                    keyboardType="decimal-pad"
                    placeholder="1.00"
                    placeholderTextColor={Brand.muted}
                  />
                  <Pressable
                    style={[styles.btn, styles.smallBtn, saveSetting.isPending && styles.btnDisabled]}
                    onPress={() => savePrice(key, val)}
                    disabled={saveSetting.isPending}
                  >
                    <Text style={styles.btnText}>Save</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* ── Feature Flags ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎛 Feature Flags</Text>
              <Text style={styles.desc}>Toggle platform features without redeploying</Text>
              {FLAGS.map(({ key, label, desc }) => {
                const isOn = s?.[key] === 'true';
                return (
                  <View key={key} style={styles.flagRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.flagLabel}>{label}</Text>
                      <Text style={styles.flagDesc}>{desc}</Text>
                    </View>
                    <Switch
                      value={isOn}
                      onValueChange={(v: boolean) => saveSetting.mutate({ key, value: v ? 'true' : 'false' })}
                      trackColor={{ false: Brand.border, true: Brand.primary + '88' }}
                      thumbColor={isOn ? Brand.primary : '#ccc'}
                      ios_backgroundColor={Brand.border}
                    />
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginBottom: 20 },

  section: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  desc: { fontSize: 12, color: Brand.muted, marginBottom: 12 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 2 },
  fieldDesc: { fontSize: 11, color: Brand.muted, marginBottom: 8 },

  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    color: Brand.text, backgroundColor: Brand.pageBg, marginBottom: 10,
  },

  btn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginBottom: 2 },
  primaryBtn: { backgroundColor: Brand.primary },
  smallBtn: { backgroundColor: Brand.primary, paddingHorizontal: 16, marginBottom: 0 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  inlineLabel: { width: 64, fontSize: 13, fontWeight: '700', color: Brand.navy },

  flagRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  flagLabel: { fontSize: 14, fontWeight: '800', color: Brand.navy },
  flagDesc: { fontSize: 11, color: Brand.muted, marginTop: 2 },
});
