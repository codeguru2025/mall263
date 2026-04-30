import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Brand } from '@/constants/brand';

/**
 * Deep-link bridge: https://mall263-r99jz.ondigitalocean.app/stores/:stallId
 * → mobile internal route /store/:stallId
 */
export default function StoresDeepLinkBridge() {
  const { stallId } = useLocalSearchParams<{ stallId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (stallId) {
      router.replace({ pathname: '/store/[stallId]', params: { stallId } } as never);
    }
  }, [stallId, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg }}>
      <ActivityIndicator size="large" color={Brand.blue} />
    </View>
  );
}
