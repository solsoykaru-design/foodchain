import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { useAuth, API_URL } from '../../services/auth';

const CATEGORIES = ['Все', 'Суп', 'Салат', 'Горячее', 'Закуска', 'Десерт', 'Выпечка', 'Напиток', 'Паста', 'Пицца', 'Роллы'];

export default function CatalogScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [tab, setTab] = useState<'my' | 'catalog'>('catalog');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');
  const [cuisines, setCuisines] = useState<any[]>([]);
  const [cuisine, setCuisine] = useState('');

  const loadMy = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50', search, category: category === 'Все' ? '' : category });
      const data = await api.get(`/api/mobile/tech-cards?${params}`);
      setItems(data.items || []);
    } catch {} finally { setLoading(false); }
  }, [search, category]);

  const loadCatalog = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50', search });
      if (category !== 'Все') params.set('category', category);
      if (cuisine) params.set('cuisine', cuisine);
      const res = await fetch(`${API_URL}/api/mobile/catalog?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {} finally { setLoading(false); }
  }, [search, category, cuisine, token]);

  const loadCuisines = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/catalog/cuisines`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCuisines(await res.json());
    } catch {}
  }, [token]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    if (tab === 'my') loadMy();
    else { loadCatalog(); loadCuisines(); }
  }, [tab, loadMy, loadCatalog, loadCuisines]));

  const handleDishTap = (name: string) => {
    router.push({ pathname: '/create', params: { dish_name: name } });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Каталог</Text>
        <Text style={s.count}>{items.length}</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity onPress={() => setTab('my')} style={[s.tab, tab === 'my' && s.tabActive]}>
          <Text style={[s.tabText, tab === 'my' && s.tabTextActive]}>Мои</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('catalog')} style={[s.tab, tab === 'catalog' && s.tabActive]}>
          <Text style={[s.tabText, tab === 'catalog' && s.tabTextActive]}>Каталог</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === 'my' ? "Поиск по названию..." : "Блюдо, кухня..."}
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

      {tab === 'catalog' && cuisines.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow}>
          <TouchableOpacity onPress={() => setCuisine('')}
            style={[s.catBtn, !cuisine && s.catBtnActive]}>
            <Text style={[s.catText, !cuisine && s.catTextActive]}>Все кухни</Text>
          </TouchableOpacity>
          {cuisines.map((c: any) => (
            <TouchableOpacity key={c.cuisine} onPress={() => setCuisine(c.cuisine)}
              style={[s.catBtn, cuisine === c.cuisine && s.catBtnActive]}>
              <Text style={[s.catText, cuisine === c.cuisine && s.catTextActive]}>{c.cuisine}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#e67e22" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>📄</Text>
          <Text style={s.emptyText}>Ничего не найдено</Text>
        </View>
      ) : tab === 'my' ? (
        <ScrollView contentContainerStyle={s.list}>
          {items.map((tc: any) => (
            <TouchableOpacity key={tc.id} onPress={() => router.push(`/card/${tc.id}`)} style={s.cardItem}>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{tc.dish_name}</Text>
                <Text style={s.cardMeta}>{tc.ingredients?.length || 0} ингр. • {tc.output || '—'}г</Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleDishTap(item.name)} style={s.cardItem}>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardMeta}>{item.cuisine} • {item.category} • {item.output}г</Text>
                <Text style={s.cardSub}>{item.description}</Text>
              </View>
              <Text style={s.cardAction}>+</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  count: { fontSize: 13, color: '#a1a1aa' },
  tabRow: { flexDirection: 'row', backgroundColor: '#e4e4e7', borderRadius: 10, padding: 2, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#71717a', fontWeight: '500' },
  tabTextActive: { color: '#18181b', fontWeight: '700' },
  search: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#18181b', marginBottom: 10 },
  catRow: { marginBottom: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', marginRight: 6, marginBottom: 4 },
  catBtnActive: { backgroundColor: '#e67e22', borderColor: '#e67e22' },
  catText: { fontSize: 12, color: '#52525b' },
  catTextActive: { color: 'white', fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#71717a' },
  list: { paddingBottom: 40 },
  cardItem: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#18181b' },
  cardMeta: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  cardSub: { fontSize: 10, color: '#d4d4d8', marginTop: 2 },
  arrow: { fontSize: 20, color: '#a1a1aa' },
  cardAction: { fontSize: 22, color: '#e67e22', fontWeight: '700', marginLeft: 8 },
});
