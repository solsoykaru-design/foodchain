import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiGenerateTechCard } from '../services/api';
import { API_URL } from '../constants/config';
import { useRouter } from 'expo-router';

interface KBJU {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

interface AIResult {
  ingredients: Ingredient[];
  kbju_per_100g: KBJU;
  output: number;
  technology: string;
  cooking_time: number;
  source: string;
}

export default function IndexScreen() {
  const router = useRouter();
  const [dishName, setDishName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    const trimmed = dishName.trim();
    if (!trimmed) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await aiGenerateTechCard(trimmed);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView style={s.flex} contentContainerStyle={s.scrollContent}>
          <View style={s.header}>
            <Text style={s.title}>AI Техкарты</Text>
            <Text style={s.subtitle}>Генерация технологических карт</Text>
          </View>

          <Text style={s.label}>Название блюда</Text>
          <TextInput
            value={dishName}
            onChangeText={setDishName}
            placeholder="Например: Салат Цезарь"
            style={s.input}
            autoFocus
          />

          <TouchableOpacity onPress={handleGenerate} disabled={loading} style={s.button}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сгенерировать</Text>}
          </TouchableOpacity>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {result ? (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>{dishName}</Text>
                <Text style={s.cardSource}>Источник: {result.source}</Text>
              </View>

              <View style={s.section}>
                <Text style={s.sectionLabel}>БЖУ на 100г</Text>
                <View style={s.badgeRow}>
                  <View style={s.badgeOrange}><Text style={s.badgeOrangeText}>{result.kbju_per_100g.calories} ккал</Text></View>
                  <View style={s.badgeBlue}><Text style={s.badgeBlueText}>Б {result.kbju_per_100g.proteins}г</Text></View>
                  <View style={s.badgeAmber}><Text style={s.badgeAmberText}>Ж {result.kbju_per_100g.fats}г</Text></View>
                  <View style={s.badgeGreen}><Text style={s.badgeGreenText}>У {result.kbju_per_100g.carbs}г</Text></View>
                </View>
              </View>

              <View style={s.row}>
                <View style={s.flex}><Text style={s.metaLabel}>Выход</Text><Text style={s.metaValue}>{result.output}г</Text></View>
                <View style={s.flex}><Text style={s.metaLabel}>Время</Text><Text style={s.metaValue}>{result.cooking_time} мин</Text></View>
              </View>

              <View style={s.section}>
                <Text style={s.sectionLabel}>Ингредиенты ({result.ingredients.length})</Text>
                {result.ingredients.map((ing, i) => (
                  <View key={i} style={s.ingredientRow}>
                    <Text style={s.ingredientName}>{ing.name}</Text>
                    <Text style={s.ingredientQty}>{ing.quantity}{ing.unit}</Text>
                  </View>
                ))}
              </View>

              {result.technology ? (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Технология</Text>
                  <Text style={s.techText}>{result.technology}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={() => router.push({ pathname: '/save', params: { dishName, result: JSON.stringify(result) } })}
                style={s.saveButton}
              >
                <Text style={s.saveButtonText}>Сохранить техкарту</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  flex: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { paddingVertical: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#18181b' },
  subtitle: { fontSize: 14, color: '#71717a', marginTop: 4 },
  label: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#18181b', marginBottom: 16 },
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 13 },
  card: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', overflow: 'hidden' },
  cardHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', backgroundColor: '#fafafa' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#18181b' },
  cardSource: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badgeOrange: { backgroundColor: '#fff7ed', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeOrangeText: { fontSize: 12, fontWeight: '600', color: '#ea580c' },
  badgeBlue: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeBlueText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  badgeAmber: { backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeAmberText: { fontSize: 12, fontWeight: '600', color: '#d97706' },
  badgeGreen: { backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeGreenText: { fontSize: 12, fontWeight: '600', color: '#059669' },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  metaLabel: { fontSize: 11, color: '#a1a1aa', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: '#27272a' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#fafafa' },
  ingredientName: { flex: 1, fontSize: 14, color: '#3f3f46' },
  ingredientQty: { fontSize: 14, fontWeight: '500', color: '#27272a' },
  techText: { fontSize: 13, color: '#52525b', lineHeight: 20 },
  saveButton: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', margin: 16 },
  saveButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
