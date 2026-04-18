import { useCallback, useState } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant } from '@/lib/stalls-api';
import { api } from '@/lib/api';

function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

type AttendantInfo = {
  name: string;
  phone: string;
  tempPassword: string;
  stallName: string;
};

export default function AttendantsScreen() {
  const qc = useQueryClient();
  const [stallIndex, setStallIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [added, setAdded] = useState<AttendantInfo | null>(null);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });
  const merchantId = meQ.data?.merchant?.id;

  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  const stalls = stallsQ.data ?? [];
  const stall = stalls[stallIndex];

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!stall) throw new Error('No stall selected');
      if (!firstName.trim() || !lastName.trim()) throw new Error('Enter first and last name.');
      const digits = phone.trim().replace(/\D/g, '');
      if (digits.length < 9) throw new Error('Enter a valid phone number with country code.');

      const tempPassword = generateTempPassword();
      const normalizedPhone = phone.trim().replace(/[\s\-().]/g, '');

      // Register a new ATTENDANT account
      const regRes = await api.post('/api/v1/auth/register', {
        phone: normalizedPhone,
        password: tempPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: 'BUYER', // Attendants start as BUYER; stall assignment upgrades their effective role
      });

      const newUserId: string | undefined =
        regRes.data?.user?.id ?? regRes.data?.id;

      if (!newUserId) throw new Error('Registration did not return a user ID.');

      // Assign to the stall
      await api.post(`/api/v1/stalls/${stall.id}/attendants`, {
        userId: newUserId,
        pin: pin.trim() || undefined,
      });

      return {
        name: `${firstName.trim()} ${lastName.trim()}`,
        phone: normalizedPhone,
        tempPassword,
        stallName: stall.name,
      };
    },
    onSuccess: (info) => {
      setAdded(info);
      setShowForm(false);
      setFirstName('');
      setLastName('');
      setPhone('');
      setPin('');
      qc.invalidateQueries({ queryKey: ['me-profile'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to add attendant.';
      Alert.alert('Error', typeof msg === 'string' ? msg : 'Please try again.');
    },
  });

  const onAdd = useCallback(() => {
    addMutation.mutate();
  }, [addMutation]);

  const resetAdded = () => setAdded(null);

  if (meQ.isPending || stallsQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  if (!merchantId || stalls.length === 0) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="users" size={40} color={Brand.muted} />
        <Text style={styles.emptyTitle}>No stall found</Text>
        <Text style={styles.emptyBody}>Set up your stall first before managing attendants.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <FontAwesome name="users" size={26} color="#fff" />
          <Text style={styles.heroTitle}>Stall attendants</Text>
          <Text style={styles.heroSub}>Manage who can run your POS register and serve customers.</Text>
        </View>

        {/* Stall picker */}
        {stalls.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Select stall</Text>
            <View style={styles.stallRow}>
              {stalls.map((s, i) => (
                <Pressable
                  key={s.id}
                  style={[styles.stallBtn, stallIndex === i && styles.stallBtnActive]}
                  onPress={() => setStallIndex(i)}
                >
                  <Text style={[styles.stallBtnText, stallIndex === i && styles.stallBtnTextActive]}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Current stall badge */}
        <View style={styles.stallBadge}>
          <FontAwesome name="shopping-bag" size={13} color={Brand.blue} />
          <Text style={styles.stallBadgeText}>{stall?.name}</Text>
          {stall?.stallNumber && (
            <Text style={styles.stallBadgeSub}>Stall #{stall.stallNumber}</Text>
          )}
        </View>

        {/* Success card */}
        {added && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <FontAwesome name="check-circle" size={18} color={Brand.green} />
              <Text style={styles.successTitle}>{added.name} added to {added.stallName}</Text>
            </View>
            <Text style={styles.successSub}>Hand them these sign-in details:</Text>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Phone</Text>
              <Text style={styles.credValue}>{added.phone}</Text>
            </View>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Password</Text>
              <Text style={styles.credValue}>{added.tempPassword}</Text>
            </View>
            <Text style={styles.credHint}>Ask them to sign in via the Mall263 app and change their password.</Text>
            <Pressable onPress={resetAdded} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {/* Info about listing */}
        <View style={styles.infoCard}>
          <FontAwesome name="info-circle" size={14} color={Brand.blue} />
          <Text style={styles.infoText}>
            Attendants you've added can access your POS register and process sales. Their accounts are linked to your stall. To see all current attendants, check your POS register — attendants logged in with your stall appear there.
          </Text>
        </View>

        {/* Add attendant */}
        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>New attendant details</Text>

            <View style={styles.nameRow}>
              <View style={styles.nameHalf}>
                <Text style={styles.label}>First name *</Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                  placeholder="Tafara" placeholderTextColor={Brand.muted} autoCapitalize="words"
                  editable={!addMutation.isPending} />
              </View>
              <View style={styles.nameHalf}>
                <Text style={styles.label}>Last name *</Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                  placeholder="Dube" placeholderTextColor={Brand.muted} autoCapitalize="words"
                  editable={!addMutation.isPending} />
              </View>
            </View>

            <Text style={styles.label}>Phone number *</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="+263771234567" keyboardType="phone-pad"
              placeholderTextColor={Brand.muted} editable={!addMutation.isPending} />
            <Text style={styles.fieldHint}>Include country code. This becomes their login.</Text>

            <Text style={styles.label}>POS PIN (optional)</Text>
            <TextInput style={styles.input} value={pin} onChangeText={setPin}
              placeholder="4-digit PIN for quick POS login"
              keyboardType="number-pad" maxLength={4}
              placeholderTextColor={Brand.muted} editable={!addMutation.isPending} />

            <View style={styles.formActions}>
              <Pressable
                style={[styles.primaryBtn, addMutation.isPending && styles.btnDisabled]}
                onPress={onAdd}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Add attendant</Text>}
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)} disabled={addMutation.isPending}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add new attendant to {stall?.name}</Text>
          </Pressable>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>How attendants work</Text>
          {[
            'Attendants can log into the Mall263 app and access the POS register for your stall',
            'They cannot edit products, view sales reports, or change stall settings',
            'You can set a short PIN for fast POS login without a full password',
            'Each attendant has their own account — sales are tracked per cashier',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <FontAwesome name="check" size={12} color={Brand.green} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  emptyBody: { fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },

  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  stallRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.pageBg,
  },
  stallBtnActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  stallBtnText: { fontSize: 13, fontWeight: '700', color: Brand.muted },
  stallBtnTextActive: { color: '#fff' },

  stallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6fc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  stallBadgeText: { fontSize: 14, fontWeight: '800', color: Brand.blue },
  stallBadgeSub: { fontSize: 12, color: Brand.muted, marginLeft: 4 },

  successCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 8,
  },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Brand.green },
  successSub: { fontSize: 13, color: '#166534' },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#bbf7d0',
  },
  credLabel: { fontSize: 13, color: '#166534', fontWeight: '600' },
  credValue: { fontSize: 15, fontWeight: '900', color: Brand.navy, letterSpacing: 0.5 },
  credHint: { fontSize: 12, color: '#166534', lineHeight: 17 },
  dismissBtn: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 },
  dismissText: { fontSize: 13, fontWeight: '700', color: Brand.muted },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6fc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: { flex: 1, fontSize: 13, color: Brand.blue, lineHeight: 19 },

  nameRow: { flexDirection: 'row', gap: 10 },
  nameHalf: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.pageBg,
  },
  fieldHint: { fontSize: 11, color: Brand.muted, marginTop: 3 },

  formActions: { gap: 10, marginTop: 16 },
  primaryBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  cancelBtnText: { color: Brand.muted, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },

  addBtn: {
    backgroundColor: Brand.navy,
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  tipText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 19 },
});
