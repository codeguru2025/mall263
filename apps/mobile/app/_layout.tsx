import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Brand } from '@/constants/brand';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { registerForPushNotifications, resolveNotificationRoute, savePushTokenToBackend } from '@/lib/push';

Sentry.init({
  dsn: (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn,
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default Sentry.wrap(function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
});

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const notifListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Register push token once on mount
    registerForPushNotifications().then((token) => {
      if (token) savePushTokenToBackend(token);
    });

    // Foreground notification received — just let the handler show the alert
    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    // User tapped a notification → deep-link into the app
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { data, type } = response.notification.request.content.data as any;
      const route = resolveNotificationRoute(data, type ?? '');
      if (route) router.push(route as any);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerBackTitle: 'Back',
              headerStyle: {
                backgroundColor: '#ffffff',
                borderBottomWidth: 1,
                borderBottomColor: Brand.border,
              } as any,
              headerShadowVisible: false,
              headerTintColor: Brand.blue,
              headerTitleStyle: { fontWeight: '800', color: Brand.navy, fontSize: 17 },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Sign in' }} />
            <Stack.Screen name="register" options={{ title: 'Create account' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
            <Stack.Screen name="store/[stallId]" options={{ title: 'Store' }} />
            <Stack.Screen name="demand/[id]" options={{ title: 'Demand' }} />
            <Stack.Screen name="demand/new" options={{ title: 'Post demand' }} />
            <Stack.Screen name="demand/open" options={{ title: 'Open demands' }} />
            <Stack.Screen name="demand/offer/[demandId]" options={{ title: 'Submit offer' }} />
            <Stack.Screen name="chat/index" options={{ title: 'Chats' }} />
            <Stack.Screen name="chat/[roomId]" options={{ title: 'Chat room' }} />
            <Stack.Screen name="deposit" options={{ title: 'Deposit funds' }} />
            <Stack.Screen name="withdraw" options={{ title: 'Withdraw funds' }} />
            <Stack.Screen name="subscriptions/index" options={{ title: 'Subscription' }} />
            <Stack.Screen name="support" options={{ title: 'Help & support' }} />
            <Stack.Screen name="disputes/index" options={{ title: 'My disputes' }} />
            <Stack.Screen name="seller/index" options={{ title: 'Seller Hub' }} />
            <Stack.Screen name="seller/setup" options={{ title: 'Seller setup' }} />
            <Stack.Screen name="seller/product/new" options={{ title: 'Add product' }} />
            <Stack.Screen name="seller/product/[id]" options={{ title: 'Edit product' }} />
            <Stack.Screen name="seller/sales" options={{ title: 'Sales' }} />
            <Stack.Screen name="seller/expenses" options={{ title: 'Expenses' }} />
            <Stack.Screen name="seller/reports" options={{ title: 'Reports' }} />
            <Stack.Screen name="malls/index" options={{ title: 'Malls' }} />
            <Stack.Screen name="malls/[id]" options={{ title: 'Mall' }} />
            <Stack.Screen name="help/faq" options={{ title: 'FAQ' }} />
            <Stack.Screen name="help/terms" options={{ title: 'Terms of service' }} />
            <Stack.Screen name="services/index" options={{ title: 'Services' }} />
            <Stack.Screen name="services/[id]" options={{ title: 'Service' }} />
            <Stack.Screen name="services/request/[listingId]" options={{ title: 'Request quote' }} />
            <Stack.Screen name="services/requests/index" options={{ title: 'Service requests' }} />
            <Stack.Screen name="services/requests/[requestId]" options={{ title: 'Request' }} />
            <Stack.Screen name="services/invoice/[invoiceId]" options={{ title: 'Invoice' }} />
            <Stack.Screen name="services/chat/[roomId]" options={{ title: 'Service chat' }} />
            <Stack.Screen name="pos/index" options={{ title: 'POS' }} />
            <Stack.Screen name="pos/cart" options={{ title: 'Register' }} />
            <Stack.Screen name="pos/receipt/[saleId]" options={{ title: 'Receipt' }} />
            <Stack.Screen name="pos/merchant-pay" options={{ title: 'Request Payment' }} />
            <Stack.Screen name="agent/index" options={{ title: 'Field Agent' }} />
            <Stack.Screen name="agent/onboard" options={{ title: 'Onboard existing buyer' }} />
            <Stack.Screen name="agent/recruit" options={{ title: 'Recruit new contact' }} />
            <Stack.Screen name="agent/capture" options={{ title: 'Capture product' }} />
            <Stack.Screen name="agent/tasks" options={{ title: 'My tasks' }} />
            <Stack.Screen name="agent/commissions" options={{ title: 'Commissions & pipeline' }} />
            <Stack.Screen name="agent/stall-verify" options={{ title: 'Verify stall' }} />
            <Stack.Screen name="agent/quality-review" options={{ title: 'Quality review' }} />
            <Stack.Screen name="seller/attendants" options={{ title: 'Stall attendants' }} />
            <Stack.Screen name="seller/qr" options={{ title: 'Shop QR Code' }} />
            <Stack.Screen name="admin/index" options={{ title: 'Admin' }} />
            <Stack.Screen name="admin/users" options={{ title: 'Users' }} />
            <Stack.Screen name="admin/stalls" options={{ title: 'Stalls' }} />
            <Stack.Screen name="admin/subscriptions" options={{ title: 'Subscriptions' }} />
            <Stack.Screen name="delivery/track/[jobId]" options={{ title: 'Track Delivery' }} />
            <Stack.Screen name="delivery/checkout" options={{ title: 'Arrange Delivery' }} />
            <Stack.Screen name="driver/register" options={{ title: 'Become a driver' }} />
            <Stack.Screen name="driver/cod" options={{ title: 'Cash on Delivery' }} />
            <Stack.Screen name="dispute/[jobId]" options={{ title: 'Open Dispute' }} />
            <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
            <Stack.Screen name="for-you" options={{ title: 'For You' }} />
            <Stack.Screen name="referral" options={{ title: 'Referrals & Promo' }} />
            <Stack.Screen name="settings/notifications" options={{ title: 'Notification preferences' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
