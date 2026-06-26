import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#e67e22' }}>
      <Tabs.Screen name="index" options={{ title: 'Главная', tabBarIcon: ({ color }) => <TabIcon name="🏠" /> }} />
      <Tabs.Screen name="subscription" options={{ title: 'Подписка', tabBarIcon: ({ color }) => <TabIcon name="💎" /> }} />
      <Tabs.Screen name="support" options={{ title: 'Поддержка', tabBarIcon: ({ color }) => <TabIcon name="💬" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color }) => <TabIcon name="⚙️" /> }} />
    </Tabs>
  );
}

function TabIcon({ name }: { name: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{name}</Text>;
}
