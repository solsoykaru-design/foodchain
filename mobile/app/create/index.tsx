import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../../services/auth';

export default function CreateScreen() {
  const { token, refreshProfile } = useAuth();
  const router = useRouter();
  const [dishName, setDishName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!dishName.trim()) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/mobile/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dish_name: dishName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации');
      setResult(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/tech-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dish_name: result.dish_name || dishName,
          ingredients: result.ingredients,
          kbju: result.kbju_per_100g,
          output: result.output,
          technology: result.technology,
          cooking_time: result.cooking_time,
          source: result.source || 'ai',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
      
      await refreshProfile();
      Alert.alert('Успех', `Техкарта создана! ${data.freeAttemptsLeft !== undefined ? `Осталось попыток: ${data.freeAttemptsLeft}` : ''}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI Генерация</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Название блюда</Text>
        <TextInput
          style={styles.input}
          placeholder="Например: Салат Цезарь, Борщ, Карбонара..."
          value={dishName}
          onChangeText={setDishName}
          placeholderTextColor="#999"
          editable={!result}
        />

        {!result && (
          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateBtnText}>✨ Сгенерировать</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {result && (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>{result.dish_name || dishName}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ингредиенты</Text>
            {result.ingredients?.map((ing: any, i: number) => (
              <View key={i} style={styles.ingRow}>
                <Text style={styles.ingName}>{ing.name}</Text>
                <Text style={styles.ingQty}>{ing.quantity}{ing.unit}</Text>
              </View>
            ))}
          </View>

          {result.kbju_per_100g && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>КБЖУ (на 100г)</Text>
              <View style={styles.kbjuRow}>
                <View style={styles.kbjuItem}>
                  <Text style={styles.kbjuValue}>{result.kbju_per_100g.calories || 0}</Text>
                  <Text style={styles.kbjuLabel}>Ккал</Text>
                </View>
                <View style={styles.kbjuItem}>
                  <Text style={styles.kbjuValue}>{result.kbju_per_100g.proteins || 0}</Text>
                  <Text style={styles.kbjuLabel}>Белки</Text>
                </View>
                <View style={styles.kbjuItem}>
                  <Text style={styles.kbjuValue}>{result.kbju_per_100g.fats || 0}</Text>
                  <Text style={styles.kbjuLabel}>Жиры</Text>
                </View>
                <View style={styles.kbjuItem}>
                  <Text style={styles.kbjuValue}>{result.kbju_per_100g.carbs || 0}</Text>
                  <Text style={styles.kbjuLabel}>Углеводы</Text>
                </View>
              </View>
            </View>
          )}

          {result.output > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Выход: {result.output}г</Text>
              {result.cooking_time > 0 && <Text style={styles.meta}>Время: {result.cooking_time} мин</Text>}
            </View>
          )}

          {result.technology && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Технология приготовления</Text>
              <Text style={styles.technology}>{result.technology}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setResult(null); setDishName(''); }}>
              <Text style={styles.cancelText}>Изменить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>💾 Сохранить</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, color: '#e67e22' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  form: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#fff' },
  generateBtn: { backgroundColor: '#e67e22', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  result: { padding: 20 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  ingName: { fontSize: 14, color: '#333', flex: 1 },
  ingQty: { fontSize: 14, color: '#666', fontWeight: '500' },
  kbjuRow: { flexDirection: 'row', justifyContent: 'space-around' },
  kbjuItem: { alignItems: 'center' },
  kbjuValue: { fontSize: 20, fontWeight: 'bold', color: '#e67e22' },
  kbjuLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  meta: { fontSize: 13, color: '#666', marginTop: 4 },
  technology: { fontSize: 14, color: '#444', lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#4caf50', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
