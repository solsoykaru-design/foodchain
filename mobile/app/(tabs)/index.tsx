import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/auth';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/mobile/tech-cards?limit=5').then(r => setRecent(r.items || [])).catch(() => {});
  }, []);

  const freeLimit = user?.tariff === 'free';
  const cardsLeft = user ? Math.max(0, 5 - (user.cardsUsed || 0)) : 0;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Здравствуйте, {user?.name || 'Пользователь'}!</Text>
            <Text style={s.subtitle}>Создание техкарт за 10 секунд</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/subscription')} style={s.tariffBadge}>
            <Text style={s.tariffText}>
              {user?.tariff === 'pro' ? 'PRO' : user?.tariff === 'business' ? 'БИЗНЕС' : `Бесплатно: ${cardsLeft}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={s.actionsRow}>
          <TouchableOpacity onPress={() => router.push('/create/voice')} style={s.actionBtn}>
            <Text style={s.actionIcon}>🎤</Text>
            <Text style={s.actionLabel}>Диктовать</Text>
            <Text style={s.actionDesc}>Голосовой ввод</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/create')} style={s.actionBtn}>
            <Text style={s.actionIcon}>✍️</Text>
            <Text style={s.actionLabel}>По названию</Text>
            <Text style={s.actionDesc}>AI-генерация</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/create/manual')} style={s.actionBtn}>
            <Text style={s.actionIcon}>📋</Text>
            <Text style={s.actionLabel}>Вручную</Text>
            <Text style={s.actionDesc}>Полная форма</Text>
          </TouchableOpacity>
        </View>

        {/* Recent */}
        <Text style={s.sectionTitle}>Последние техкарты</Text>
        {recent.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📄</Text>
            <Text style={s.emptyText}>Пока нет созданных техкарт</Text>
            <Text style={s.emptyHint}>Создайте первую через AI или вручную</Text>
          </View>
        ) : (
          recent.map((tc: any) => (
            <TouchableOpacity key={tc.id} onPress={() => router.push(`/card/${tc.id}`)} style={s.cardItem}>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{tc.dish_name}</Text>
                <Text style={s.cardMeta}>{tc.ingredient_count} ингр. • {tc.output || '—'}г • {tc.cooking_time || '—'} мин</Text>
              </View>
              <Text style={s.cardArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, marginTop: 8 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#18181b' },
  subtitle: { fontSize: 13, color: '#71717a', marginTop: 4 },
  tariffBadge: { backgroundColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  tariffText: { color: 'white', fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  actionBtn: { flex: 1, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', padding: 16, alignItems: 'center' },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: '#18181b' },
  actionDesc: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#18181b', marginBottom: 12 },
  emptyBox: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#52525b' },
  emptyHint: { fontSize: 12, color: '#a1a1aa', marginTop: 4 },
  cardItem: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#18181b' },
  cardMeta: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  cardArrow: { fontSize: 20, color: '#a1a1aa' },
});
