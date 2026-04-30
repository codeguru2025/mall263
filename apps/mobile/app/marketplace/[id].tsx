import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Brand } from '@/constants/brand';

/**
 * Deep-link bridge: https://mall263-r99jz.ondigitalocean.app/marketplace/:id
 * → mobile internal route /product/:id
 */
export default function MarketplaceDeepLinkBridge() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace({ pathname: '/product/[id]', params: { id } } as never);
    }
  }, [id, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg }}>
      <ActivityIndicator size="large" color={Brand.blue} />
    </View>
  );
}
