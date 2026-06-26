import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../../services/auth';

interface TechCard {
  id: number;
  dish_name: string;
  output: number;
  cooking_time: number;
  created_at: string;
}

export default function HomeScreen() {
  const { user, token, refreshProfile } = useAuth();
  const router = useRouter();
  const [cards, setCards] = useState<TechCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [access, setAccess] = useState<any>(null);

  const loadCards = useCallback(async () => {
    if (!token) return;
    try {
      const [cardsRes, accessRes] = await Promise.all([
        fetch(`${API_URL}/api/mobile/tech-cards?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/mobile/check-access`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cardsRes.ok) {
        const data = await cardsRes.json();
        setCards(data.items || []);
      }
      if (accessRes.ok) {
        const data = await accessRes.json();
        setAccess(data);
      }
    } catch (e) {
      console.error('Load error:', e);
    }
  }, [token]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadCards();
    setRefreshing(false);
  };

  const canCreate = access?.canCreate ?? (user?.freeAttempts && user.freeAttempts > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Привет, {user?.name || 'Пользователь'}!</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarBtn}>
          <Text style={styles.avatarText}>👤</Text>
        </TouchableOpacity>
      </View>

      {access && (
        <View style={styles.attemptsBar}>
          {access.isSubscribed ? (
            <Text style={styles.attemptsText}>✅ Подписка активна{access.tariffUntil ? ` до ${new Date(access.tariffUntil).toLocaleDateString('ru')}` : ''}</Text>
          ) : (
            <Text style={styles.attemptsText}>
              🎯 Осталось <Text style={styles.attemptsCount}>{access.freeAttempts}</Text> бесплатных попыток
            </Text>
          )}
          {!access.isSubscribed && access.freeAttempts <= 1 && (
            <TouchableOpacity onPress={() => router.push('/subscription')} style={styles.subBadge}>
              <Text style={styles.subBadgeText}>Оформить подписку →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionVoice, !canCreate && styles.actionDisabled]}
          onPress={() => canCreate ? router.push('/create/voice') : router.push('/subscription')}
        >
          <Text style={styles.actionIcon}>🎤</Text>
          <Text style={styles.actionTitle}>Диктовать</Text>
          <Text style={styles.actionDesc}>Голосовой ввод</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionText, !canCreate && styles.actionDisabled]}
          onPress={() => canCreate ? router.push('/create') : router.push('/subscription')}
        >
          <Text style={styles.actionIcon}>✍️</Text>
          <Text style={styles.actionTitle}>Ввести название</Text>
          <Text style={styles.actionDesc}>AI генерация</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionManual, !canCreate && styles.actionDisabled]}
          onPress={() => canCreate ? router.push('/create/manual') : router.push('/subscription')}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionTitle}>Вручную</Text>
          <Text style={styles.actionDesc}>Авторская ТК</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Последние техкарты</Text>
        <FlatList
          data={cards}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyText}>Пока нет техкарт</Text>
              <Text style={styles.emptySubtext}>Создайте первую техкарту!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/card/${item.id}`)}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardName}>{item.dish_name}</Text>
                <Text style={styles.cardMeta}>
                  {item.output > 0 ? `${item.output}г` : ''}{item.output > 0 && item.cooking_time > 0 ? ' · ' : ''}{item.cooking_time > 0 ? `${item.cooking_time} мин` : ''}
                </Text>
              </View>
              <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('ru')}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Главная</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/subscription')}>
          <Text style={styles.navIcon}>💎</Text>
          <Text style={styles.navLabel}>Подписка</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/support')}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>Поддержка</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Профиль</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  phone: { fontSize: 13, color: '#999', marginTop: 2 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22 },
  attemptsBar: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attemptsText: { fontSize: 14, color: '#333', flex: 1 },
  attemptsCount: { fontWeight: 'bold', color: '#e67e22' },
  subBadge: { backgroundColor: '#e67e22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  subBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  actions: { flexDirection: 'row', padding: 16, gap: 10 },
  actionBtn: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  actionVoice: { backgroundColor: '#e8f5e9' },
  actionText: { backgroundColor: '#fff3e0' },
  actionManual: { backgroundColor: '#e3f2fd' },
  actionDisabled: { opacity: 0.5 },
  actionIcon: { fontSize: 32, marginBottom: 6 },
  actionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
  actionDesc: { fontSize: 10, color: '#666', textAlign: 'center', marginTop: 2 },
  section: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#666' },
  emptySubtext: { fontSize: 13, color: '#999', marginTop: 4 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8 },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  cardMeta: { fontSize: 12, color: '#999', marginTop: 4 },
  cardDate: { fontSize: 12, color: '#bbb' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 8, paddingBottom: 20 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 10, color: '#666', marginTop: 2 },
});
