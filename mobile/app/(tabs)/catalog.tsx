import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';

const CATEGORIES = ['Все', 'Супы', 'Салаты', 'Горячее', 'Закуски', 'Десерты', 'Напитки', 'Выпечка'];

export default function CatalogScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', search, category: category === 'Все' ? '' : category });
      const data = await api.get(`/api/mobile/tech-cards?${params}`);
      setItems(data.items || []);
    } catch {} finally { setLoading(false); }
  }, [search, category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Каталог техкарт</Text>
        <Text style={s.count}>{items.length} шт.</Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Поиск по названию..."
        style={s.search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)}
            style={[s.catBtn, category === c && s.catBtnActive]}>
            <Text style={[s.catText, category === c && s.catTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>📄</Text>
          <Text style={s.emptyText}>Ничего не найдено</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {items.map((tc: any) => (
            <TouchableOpacity key={tc.id} onPress={() => router.push(`/card/${tc.id}`)} style={s.cardItem}>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{tc.dish_name}</Text>
                <Text style={s.cardMeta}>{tc.ingredient_count || 0} ингр. • {tc.output || '—'}г</Text>
              </View>
              <View style={s.cardRight}>
                {tc.cost_price > 0 && <Text style={s.cost}>{tc.cost_price}₽</Text>}
                <Text style={s.arrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  count: { fontSize: 13, color: '#a1a1aa' },
  search: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#18181b', marginBottom: 12 },
  catRow: { marginBottom: 16 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', marginRight: 8 },
  catBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catText: { fontSize: 13, color: '#52525b' },
  catTextActive: { color: 'white', fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#71717a' },
  list: { paddingBottom: 40 },
  cardItem: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#18181b' },
  cardMeta: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cost: { fontSize: 13, fontWeight: '600', color: '#059669' },
  arrow: { fontSize: 20, color: '#a1a1aa' },
});
