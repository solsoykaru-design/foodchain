import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ name }: { name: string }) {
  return <Text style={{ fontSize: 20 }}>{name}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#e67e22' }}>
      <Tabs.Screen name="index" options={{ title: 'Главная', tabBarIcon: () => <TabIcon name="🏠" /> }} />
      <Tabs.Screen name="catalog" options={{ title: 'Каталог', tabBarIcon: () => <TabIcon name="📖" /> }} />
      <Tabs.Screen name="subscription" options={{ title: 'Подписка', tabBarIcon: () => <TabIcon name="💎" /> }} />
      <Tabs.Screen name="support" options={{ title: 'Поддержка', tabBarIcon: () => <TabIcon name="💬" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: () => <TabIcon name="⚙️" /> }} />
    </Tabs>
  );
}
