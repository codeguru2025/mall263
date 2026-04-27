import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';

function TabIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function DriverLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: Brand.blue }}>
      <Tabs.Screen
        name="onboarding"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color }) => <TabIcon name="file-text" color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Available',
          tabBarIcon: ({ color }) => <TabIcon name="map-marker" color={color} />,
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: 'Active Job',
          tabBarIcon: ({ color }) => <TabIcon name="truck" color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <TabIcon name="dollar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="runs"
        options={{
          title: 'Multi-Runs',
          tabBarIcon: ({ color }) => <TabIcon name="sitemap" color={color} />,
        }}
      />
    </Tabs>
  );
}
