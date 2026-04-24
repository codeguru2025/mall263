import { Redirect } from 'expo-router';
import { getStaffHomePath } from '@mall263/shared';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { isReady, isAuthenticated, user } = useAuth();

  if (!isReady) return null;

  if (isAuthenticated) {
    const staffHome = getStaffHomePath(user?.role);
    if (staffHome) return <Redirect href={staffHome as never} />;
    return <Redirect href="/(tabs)" />;
  }

  // Guests land on the shop so they can browse immediately
  return <Redirect href="/(tabs)/shop" />;
}
