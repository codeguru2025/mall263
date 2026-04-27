import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';

type Props = {
  title?: string;
  description?: string;
};

export function GuestSignInPrompt({
  title = 'Sign in to continue',
  description = 'Create a free account or sign in to access this feature.',
}: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>
        <FontAwesome name="lock" size={32} color={Brand.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <Pressable
        style={styles.primaryBtn}
        onPress={() => router.push('/login')}
        android_ripple={{ color: '#ffffff33' }}
      >
        <Text style={styles.primaryBtnText}>Sign in</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => router.push('/register')}
        android_ripple={{ color: '#00000011' }}
      >
        <Text style={styles.secondaryBtnText}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Brand.pageBg,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Brand.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: Brand.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Brand.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: Brand.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Brand.card,
  },
  secondaryBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },
});
