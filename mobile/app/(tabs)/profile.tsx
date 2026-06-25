import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/auth';
import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    api.get('/api/mobile/profile').then(setStats).catch(() => {});
  }, []);

  const tariffName = user?.tariff === 'pro' ? 'Профессиональный' : user?.tariff === 'business' ? 'Бизнес' : 'Бесплатный';
  const tariffColor = user?.tariff === 'pro' ? '#3b82f6' : user?.tariff === 'business' ? '#8b5cf6' : '#71717a';

  const handleLogout = () => {
    Alert.alert('Выйти', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)'); } },
    ]);
  };

  const menuItems = [
    { icon: '💳', label: 'Подписка и оплата', onPress: () => router.push('/subscription'), badge: tariffName },
    { icon: '📄', label: 'Мои техкарты', onPress: () => router.push('/(tabs)/catalog') },
    { icon: '📊', label: 'Статистика', onPress: () => {},
      badge: stats.totalCards ? `${stats.totalCards} карт` : undefined },
    { icon: '🔗', label: 'Пригласить друга', onPress: () => {} },
    { icon: '⚙️', label: 'Настройки', onPress: () => {} },
    { icon: '❓', label: 'Помощь', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{user?.name || 'Пользователь'}</Text>
          <Text style={s.phone}>+{user?.phone}</Text>
          <View style={[s.tariffBadge, { backgroundColor: tariffColor }]}>
            <Text style={s.tariffText}>{tariffName}</Text>
          </View>
        </View>

        <View style={s.menuSection}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} onPress={item.onPress} style={s.menuItem}>
              <Text style={s.menuIcon}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
              {item.badge && <Text style={s.menuBadge}>{item.badge}</Text>}
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 16, paddingBottom: 40 },
  profileCard: { alignItems: 'center', paddingVertical: 24, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 24, fontWeight: '700', color: 'white' },
  name: { fontSize: 18, fontWeight: '700', color: '#18181b' },
  phone: { fontSize: 13, color: '#71717a', marginTop: 4 },
  tariffBadge: { marginTop: 12, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  tariffText: { color: 'white', fontSize: 13, fontWeight: '600' },
  menuSection: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', overflow: 'hidden', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, color: '#18181b' },
  menuBadge: { fontSize: 12, color: '#71717a', marginRight: 8 },
  menuArrow: { fontSize: 18, color: '#a1a1aa' },
  logoutBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  logoutText: { fontSize: 14, color: '#ef4444' },
});
