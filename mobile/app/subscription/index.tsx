import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/auth';

const PLANS = [
  {
    id: 'free',
    name: 'Демо',
    price: '0 ₽',
    period: 'навсегда',
    color: '#71717a',
    features: ['5 техкарт в месяц', 'Только текстовый ввод', 'Водяной знак "Демо"', 'Без экспорта PDF'],
  },
  {
    id: 'pro',
    name: 'Профессиональный',
    price: '990 ₽',
    period: '/месяц',
    color: '#3b82f6',
    popular: true,
    features: ['Неограниченно техкарт', 'Голосовой + текстовый ввод', 'Экспорт PDF без водяных знаков', 'Печать', 'История'],
  },
  {
    id: 'business',
    name: 'Бизнес',
    price: '2 990 ₽',
    period: '/месяц',
    color: '#8b5cf6',
    features: ['Всё из Профессионального', 'Общий доступ для команды', 'API-доступ', 'Приоритетная поддержка'],
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [selected, setSelected] = useState(user?.tariff === 'pro' ? 'pro' : user?.tariff === 'business' ? 'business' : 'free');

  const currentTariff = user?.tariff || 'free';

  const handleSubscribe = (planId: string) => {
    if (planId === currentTariff) return;
    if (planId === 'free') {
      // Already free, no action needed
      return;
    }
    router.push({ pathname: '/payment', params: { planId } });
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>
        <Text style={s.title}>Подписка</Text>
        <Text style={s.subtitle}>Выберите тариф для доступа ко всем функциям</Text>

        {PLANS.map(plan => {
          const isCurrent = plan.id === currentTariff;
          const isSelected = plan.id === selected;
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              style={[s.planCard, isSelected && s.planSelected, isCurrent && s.planCurrent]}
            >
              {plan.popular && <View style={s.popularBadge}><Text style={s.popularText}>Популярное</Text></View>}
              {isCurrent && <View style={s.currentBadge}><Text style={s.currentBadgeText}>Текущий тариф</Text></View>}
              <View style={s.planHeader}>
                <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
                <View style={s.priceRow}>
                  <Text style={s.price}>{plan.price}</Text>
                  <Text style={s.period}>{plan.period}</Text>
                </View>
              </View>
              <View style={s.features}>
                {plan.features.map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <Text style={s.check}>✓</Text>
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              {!isCurrent && (
                <TouchableOpacity
                  onPress={() => handleSubscribe(plan.id)}
                  style={[s.subscribeBtn, { backgroundColor: plan.color }]}
                >
                  <Text style={s.subscribeText}>{plan.price === '0 ₽' ? 'Выбрать' : `Оформить за ${plan.price}`}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        <Text style={s.trialNote}>* Пробный период 7 дней бесплатного доступа к Профессиональному тарифу</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 16, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  subtitle: { fontSize: 13, color: '#71717a', marginTop: 4, marginBottom: 20 },
  planCard: { backgroundColor: 'white', borderRadius: 16, borderWidth: 2, borderColor: '#e4e4e7', padding: 20, marginBottom: 12, position: 'relative' },
  planSelected: { borderColor: '#3b82f6' },
  planCurrent: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  popularBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3 },
  popularText: { color: 'white', fontSize: 11, fontWeight: '600' },
  currentBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: '#10b981', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3 },
  currentBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  planHeader: { marginBottom: 16 },
  planName: { fontSize: 18, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  price: { fontSize: 28, fontWeight: '700', color: '#18181b' },
  period: { fontSize: 14, color: '#71717a', marginLeft: 4 },
  features: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  check: { fontSize: 14, color: '#10b981', marginRight: 8, fontWeight: '700' },
  featureText: { fontSize: 13, color: '#52525b' },
  subscribeBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  subscribeText: { color: 'white', fontWeight: '700', fontSize: 15 },
  trialNote: { fontSize: 11, color: '#a1a1aa', textAlign: 'center', marginTop: 16 },
});
