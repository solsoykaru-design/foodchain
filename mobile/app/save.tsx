import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiSaveTechCard } from '../services/api';

export default function SaveScreen() {
  const router = useRouter();
  const { dishName, result: resultJson } = useLocalSearchParams();
  const parsed = resultJson ? JSON.parse(resultJson as string) : null;

  const [saving, setSaving] = useState(false);
  const [editIngredients] = useState(parsed?.ingredients?.map((i: any) => ({
    item_name: i.name,
    quantity: i.quantity,
    unit: i.unit || 'г',
  })) || []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await aiSaveTechCard({
        dish_name: dishName,
        ingredients: editIngredients,
        kbju_per_100g: parsed?.kbju_per_100g || {},
        output: parsed?.output || 300,
        technology: parsed?.technology || '',
        cooking_time: parsed?.cooking_time || 0,
      });
      const msgs: string[] = [];
      if (res.menuItemCreated) msgs.push('Блюдо создано в меню');
      if (res.createdItems?.length > 0) msgs.push(`Создано ингредиентов: ${res.createdItems.length}`);
      if (res.createdCategories?.length > 0) msgs.push(`Категории: ${res.createdCategories.join(', ')}`);
      Alert.alert('Сохранено!', msgs.join('\n') || 'Техкарта создана');
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!parsed) {
    return (
      <SafeAreaView style={s.containerCenter}>
        <Text style={s.emptyText}>Нет данных для сохранения</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView style={s.flex} contentContainerStyle={s.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={s.title}>{dishName}</Text>
          <Text style={s.ingCount}>Ингредиенты ({editIngredients.length})</Text>

          {editIngredients.map((ing: any, i: number) => (
            <View key={i} style={s.ingredientCard}>
              <Text style={s.ingredientName}>{ing.item_name}</Text>
              <View style={s.inputRow}>
                <TextInput
                  value={String(ing.quantity)}
                  keyboardType="decimal-pad"
                  style={s.qtyInput}
                />
                <TextInput
                  value={ing.unit}
                  style={s.unitInput}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveButton}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={s.saveText}>Сохранить</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  containerCenter: { flex: 1, backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  backButton: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#18181b', marginBottom: 16 },
  ingCount: { fontSize: 12, color: '#71717a', marginBottom: 12 },
  emptyText: { color: '#71717a', fontSize: 15 },
  ingredientCard: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 12, marginBottom: 8 },
  ingredientName: { fontSize: 14, fontWeight: '500', color: '#27272a', marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 8 },
  qtyInput: { flex: 1, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14 },
  unitInput: { width: 64, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, textAlign: 'center' },
  saveButton: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
