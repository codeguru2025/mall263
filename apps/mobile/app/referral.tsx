import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { fetchMeProfile } from '@/lib/me-profile';
import { validatePromoCode } from '@/lib/subscriptions-api';

export default function ReferralScreen() {
  const [promoCode, setPromoCode] = useState('');

  const profileQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });

  const validateMutation = useMutation({
    mutationFn: () => validatePromoCode(promoCode.trim().toUpperCase()),
    onSuccess: (result) => {
      if (result.valid) {
        const parts: string[] = [];
        if (result.discount) parts.push(`${result.discount}% discount`);
        if (result.months) parts.push(`${result.months} free month${result.months === 1 ? '' : 's'}`);
        Alert.alert(
          'Valid code!',
          parts.length > 0 ? parts.join(' + ') : result.message || 'Code accepted.',
        );
      } else {
        Alert.alert('Invalid code', result.message || 'That code is not valid or has expired.');
      }
    },
    onError: () => {
      Alert.alert('Error', 'Could not check the code. Try again.');
    },
  });

  const onValidate = useCallback(() => {
    if (!promoCode.trim()) {
      Alert.alert('Enter a code', 'Please type a promo code first.');
      return;
    }
    validateMutation.mutate();
  }, [promoCode, validateMutation]);

  const profile = profileQ.data;
  const displayPhone = profile?.phone ?? '…';

  const onCopyPhone = useCallback(async () => {
    if (!profile?.phone) return;
    await Share.share({ message: `My Mall263 referral number: ${profile.phone}` });
  }, [profile?.phone]);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <FontAwesome name="gift" size={32} color="#fff" />
          <Text style={styles.heroTitle}>Referrals & Promo</Text>
          <Text style={styles.heroSub}>Share the platform and save on subscriptions</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your referral identity</Text>
          <Text style={styles.body}>
            Share your phone number with a friend. When they sign up and mention your number, the
            referral is credited to your account by the Mall263 team.
          </Text>
          <View style={styles.phoneRow}>
            <Text style={styles.phoneText}>{displayPhone}</Text>
            <Pressable style={styles.copyBtn} onPress={onCopyPhone} hitSlop={8}>
              <FontAwesome name="share" size={14} color={Brand.blue} />
              <Text style={styles.copyBtnText}>Share</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Automated referral codes are on the roadmap. For now, referrals are tracked manually by our team.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Have a promo code?</Text>
          <Text style={styles.body}>
            Enter a subscription promo code below to check its discount before applying it at checkout.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. LAUNCH50"
            placeholderTextColor={Brand.muted}
            value={promoCode}
            onChangeText={(t) => setPromoCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onValidate}
          />
          <Pressable
            style={[styles.validateBtn, validateMutation.isPending && styles.btnDisabled]}
            onPress={onValidate}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.validateBtnText}>Check code</Text>
            )}
          </Pressable>

          {validateMutation.data && (
            <View style={[styles.resultBox, validateMutation.data.valid ? styles.resultOk : styles.resultBad]}>
              <FontAwesome
                name={validateMutation.data.valid ? 'check-circle' : 'times-circle'}
                size={16}
                color={validateMutation.data.valid ? Brand.green : Brand.red}
              />
              <Text style={[styles.resultText, { color: validateMutation.data.valid ? Brand.green : Brand.red }]}>
                {validateMutation.data.valid
                  ? validateMutation.data.message || 'Code is valid'
                  : validateMutation.data.message || 'Invalid or expired code'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>How it works</Text>
          {[
            { icon: 'share-alt', text: 'Share your phone number with friends and family' },
            { icon: 'user-plus', text: 'They sign up on Mall263 and mention you' },
            { icon: 'star', text: 'Our team credits the referral to your account' },
            { icon: 'tag', text: 'Use a promo code at subscription checkout for a discount' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <FontAwesome name={step.icon as any} size={14} color={Brand.blue} />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', fontWeight: '500' },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: { fontSize: 14, color: '#334155', lineHeight: 21 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.pageBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  phoneText: { fontSize: 18, fontWeight: '800', color: Brand.navy, letterSpacing: 0.5 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  copyBtnText: { fontSize: 13, fontWeight: '700', color: Brand.blue },
  hint: { fontSize: 12, color: Brand.muted, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    fontSize: 17,
    fontWeight: '800',
    color: Brand.navy,
    backgroundColor: Brand.pageBg,
    letterSpacing: 2,
  },
  validateBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  validateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  resultOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  resultBad: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  resultText: { flex: 1, fontSize: 14, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    flexShrink: 0,
  },
  stepText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 21 },
});
