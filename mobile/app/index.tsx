import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiGenerateTechCard, setBaseUrl } from '../services/api';
import { API_URL } from '../constants/config';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

interface AIResult {
  ingredients: Ingredient[];
  kbju_per_100g: { calories: number; proteins: number; fats: number; carbs: number };
  output: number;
  technology: string;
  cooking_time: number;
  source: string;
  matched_ingredients?: any[];
  unmatched_ingredients?: any[];
}

export default function IndexScreen() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrlState] = useState(API_URL);
  const [dishName, setDishName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    const trimmed = dishName.trim();
    if (!trimmed) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      setBaseUrl(serverUrl);
      const data = await aiGenerateTechCard(trimmed);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const totalMatchCount = (result?.matched_ingredients?.length || 0) + (result?.unmatched_ingredients?.length || 0);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView style={s.flex} contentContainerStyle={s.scrollContent}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerRow}>
              <View>
                <Text style={s.title}>AI Техкарты</Text>
                <Text style={s.subtitle}>Генерация технологических карт</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSettings(v => !v)} style={s.settingsBtn}>
                <Text style={s.settingsBtnText}>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings panel */}
          {showSettings && (
            <View style={s.settingsPanel}>
              <Text style={s.label}>Адрес сервера</Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrlState}
                placeholder="https://..."
                style={s.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={s.hint}>Укажите URL бэкенда (например https://foodchain.onrender.com)</Text>
            </View>
          )}

          {/* Dish name input */}
          <Text style={s.label}>Название блюда</Text>
          <TextInput
            value={dishName}
            onChangeText={setDishName}
            placeholder="Например: Салат Цезарь"
            style={s.input}
            autoFocus
          />

          {/* Generate button */}
          <TouchableOpacity onPress={handleGenerate} disabled={loading} style={s.button}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сгенерировать</Text>}
          </TouchableOpacity>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Result card */}
          {result ? (
            <View style={s.card}>
              {/* Header */}
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>{dishName}</Text>
                <Text style={s.cardSource}>Источник: {result.source}</Text>
              </View>

              {/* KBJU */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>БЖУ на 100г</Text>
                <View style={s.badgeRow}>
                  <View style={s.badgeOrange}><Text style={s.badgeOrangeText}>{result.kbju_per_100g.calories} ккал</Text></View>
                  <View style={s.badgeBlue}><Text style={s.badgeBlueText}>Б {result.kbju_per_100g.proteins}г</Text></View>
                  <View style={s.badgeAmber}><Text style={s.badgeAmberText}>Ж {result.kbju_per_100g.fats}г</Text></View>
                  <View style={s.badgeGreen}><Text style={s.badgeGreenText}>У {result.kbju_per_100g.carbs}г</Text></View>
                </View>
              </View>

              {/* Output & Time */}
              <View style={s.infoRow}>
                <View style={s.infoItem}><Text style={s.infoLabel}>Выход</Text><Text style={s.infoValue}>{result.output}г</Text></View>
                <View style={s.infoItem}><Text style={s.infoLabel}>Время</Text><Text style={s.infoValue}>{result.cooking_time} мин</Text></View>
                {totalMatchCount > 0 && (
                  <View style={s.infoItem}><Text style={s.infoLabel}>Ингредиентов</Text><Text style={s.infoValue}>{totalMatchCount}</Text></View>
                )}
              </View>

              {/* Ingredients */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>Ингредиенты</Text>
                {(result.matched_ingredients?.length || result.unmatched_ingredients?.length)
                  ? [...(result.matched_ingredients || []), ...(result.unmatched_ingredients || [])]
                  : (result.ingredients || [])
                .map((ing: any, i: number) => (
                  <View key={i} style={s.ingredientRow}>
                    <Text style={s.ingredientName}>{ing.item_name || ing.name}</Text>
                    <Text style={s.ingredientQty}>{ing.quantity}{ing.unit}</Text>
                  </View>
                ))}
              </View>

              {/* Technology */}
              {result.technology ? (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Технология</Text>
                  <Text style={s.techText}>{result.technology}</Text>
                </View>
              ) : null}

              {/* Save button */}
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/save', params: { dishName, result: JSON.stringify(result) } })}
                style={s.saveBtn}
              >
                <Text style={s.saveBtnText}>Сохранить техкарту</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: '700', color: '#18181b' },
  subtitle: { fontSize: 14, color: '#71717a', marginTop: 4 },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center' },
  settingsBtnText: { fontSize: 18 },
  settingsPanel: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 12, marginBottom: 16 },
  hint: { fontSize: 11, color: '#a1a1aa', marginTop: 4 },
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
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badgeOrange: { backgroundColor: '#fff7ed', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeOrangeText: { fontSize: 12, fontWeight: '600', color: '#ea580c' },
  badgeBlue: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeBlueText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  badgeAmber: { backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeAmberText: { fontSize: 12, fontWeight: '600', color: '#d97706' },
  badgeGreen: { backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeGreenText: { fontSize: 12, fontWeight: '600', color: '#059669' },
  infoRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#a1a1aa', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#27272a' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#fafafa' },
  ingredientName: { flex: 1, fontSize: 14, color: '#3f3f46' },
  ingredientQty: { fontSize: 14, fontWeight: '500', color: '#27272a' },
  techText: { fontSize: 13, color: '#52525b', lineHeight: 20 },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', margin: 16 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
