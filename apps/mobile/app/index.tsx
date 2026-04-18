import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) return null;

  // Authenticated users go to their home dashboard
  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  // Guests land on the shop so they can browse immediately
  return <Redirect href="/(tabs)/shop" />;
}
