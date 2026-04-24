import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import Colors from '@/constants/Colors';
import { Brand } from '@/constants/brand';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { fetchNotificationsPage } from '@/lib/notifications-api';
import { isStaffAdminRole } from '@mall263/shared';

const SELLER_ROLES = new Set(['STALL_OWNER', 'ATTENDANT']);
const AGENT_ROLES = new Set(['FIELD_AGENT']);

const SHARED_HEADER = {
  headerStyle: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  headerShadowVisible: false,
  headerTintColor: Brand.blue,
  headerTitleStyle: { fontWeight: '800' as const, color: Brand.navy, fontSize: 17 },
};

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isReady, isAuthenticated, user } = useAuth();

  const { data: notifPage } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => fetchNotificationsPage(1, 1, 'unread'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    retry: 2,
  });
  const unreadCount = notifPage?.unreadCount ?? 0;
  // Must not follow `if (!isReady) return` — hooks must run every render in the same order.
  const headerShown = useClientOnlyValue(false, true);

  if (!isReady) return null;

  const role = user?.role ?? '';
  const isSeller = SELLER_ROLES.has(role);
  const isAgent = AGENT_ROLES.has(role);
  const isStaff = isStaffAdminRole(role);
  const showConsumerMoneyTabs = !isAuthenticated || !isStaff;

  return (
    <Tabs
      initialRouteName="shop"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown,
        ...SHARED_HEADER,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerTitle: () => <Logo size={32} />,
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          headerShown: false,
          href: showConsumerMoneyTabs ? undefined : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-cart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="demands"
        options={{
          title: 'Demands',
          href: showConsumerMoneyTabs ? undefined : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          href: showConsumerMoneyTabs ? undefined : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
        }}
      />
      <Tabs.Screen
        name="seller"
        options={{
          title: 'Seller Hub',
          headerShown: false,
          href: isSeller ? undefined : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="building" color={color} />,
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          title: 'Agent',
          href: isAgent ? undefined : null,
          tabBarIcon: ({ color }) => <TabBarIcon name="map-marker" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
