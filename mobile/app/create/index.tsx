import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { aiGenerateTechCard } from '../../services/api';

export default function CreateByNameScreen() {
  const router = useRouter();
  const [dishName, setDishName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!dishName.trim()) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    setLoading(true);
    setResult(null);
    try {
      const data = await aiGenerateTechCard(dishName.trim());
      setResult(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setLoading(false); }
  };

  const totalMatch = (result?.matched_ingredients?.length || 0) + (result?.unmatched_ingredients?.length || 0);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>
          <Text style={s.title}>Создать по названию</Text>
          <Text style={s.subtitle}>AI определит ингредиенты, КБЖУ и технологию</Text>

          <TextInput
            value={dishName}
            onChangeText={setDishName}
            placeholder="Например: Салат Цезарь, Борщ..."
            style={s.input}
            autoFocus
          />

          <TouchableOpacity onPress={handleGenerate} disabled={loading} style={s.button}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сгенерировать</Text>}
          </TouchableOpacity>

          {result && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>{dishName}</Text>
                <Text style={s.source}>Источник: {result.source}</Text>
              </View>

              <View style={s.section}>
                <Text style={s.label}>КБЖУ на 100г</Text>
                <View style={s.badgeRow}>
                  <View style={s.badge}><Text style={s.badgeText}>🔥 {result.kbju_per_100g.calories} ккал</Text></View>
                  <View style={s.badge}><Text style={s.badgeText}>Б {result.kbju_per_100g.proteins}г</Text></View>
                  <View style={s.badge}><Text style={s.badgeText}>Ж {result.kbju_per_100g.fats}г</Text></View>
                  <View style={s.badge}><Text style={s.badgeText}>У {result.kbju_per_100g.carbs}г</Text></View>
                </View>
              </View>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Выход: {result.output}г</Text>
                <Text style={s.infoLabel}>Время: {result.cooking_time} мин</Text>
                {totalMatch > 0 && <Text style={s.infoLabel}>Ингредиентов: {totalMatch}</Text>}
              </View>

              <View style={s.section}>
                <Text style={s.label}>Ингредиенты</Text>
                {(result.matched_ingredients?.length || result.unmatched_ingredients?.length
                  ? [...(result.matched_ingredients || []), ...(result.unmatched_ingredients || [])]
                  : (result.ingredients || [])
                ).map((ing: any, i: number) => (
                  <View key={i} style={s.ingRow}>
                    <Text style={s.ingName}>{ing.item_name || ing.name}</Text>
                    <Text style={s.ingQty}>{ing.quantity}{ing.unit}</Text>
                  </View>
                ))}
              </View>

              {result.technology ? (
                <View style={s.section}>
                  <Text style={s.label}>Технология</Text>
                  <Text style={s.techText}>{result.technology}</Text>
                </View>
              ) : null}

              <View style={s.actions}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/save', params: { dishName, result: JSON.stringify(result) } })}
                  style={s.saveBtn}
                >
                  <Text style={s.saveBtnText}>Сохранить техкарту</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setResult(null); setDishName(''); }} style={s.resetBtn}>
                  <Text style={s.resetText}>Создать ещё</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  subtitle: { fontSize: 13, color: '#71717a', marginTop: 4, marginBottom: 20 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#18181b', marginBottom: 12 },
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', overflow: 'hidden' },
  cardHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#18181b' },
  source: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  label: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { backgroundColor: '#f4f4f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#52525b' },
  infoRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', gap: 16 },
  infoLabel: { fontSize: 12, color: '#52525b' },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#fafafa' },
  ingName: { flex: 1, fontSize: 14, color: '#3f3f46' },
  ingQty: { fontSize: 14, fontWeight: '500', color: '#27272a' },
  techText: { fontSize: 13, color: '#52525b', lineHeight: 20 },
  actions: { padding: 16, gap: 8 },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  resetBtn: { alignItems: 'center', paddingVertical: 8 },
  resetText: { color: '#3b82f6', fontSize: 14 },
});
