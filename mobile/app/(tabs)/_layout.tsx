import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

function TabIcon({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: 'white', borderTopColor: '#f4f4f5', paddingBottom: 4, height: 60 },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: () => <TabIcon label="Главная" icon="🏠" /> }} />
      <Tabs.Screen name="catalog" options={{ tabBarIcon: () => <TabIcon label="Каталог" icon="📋" /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: () => <TabIcon label="Профиль" icon="👤" /> }} />
    </Tabs>
  );
}
