import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiSaveTechCard } from '../services/api';

const UNITS = ['г', 'кг', 'мл', 'л', 'шт'];

interface EditIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export default function SaveScreen() {
  const router = useRouter();
  const { dishName, result: resultJson } = useLocalSearchParams();
  const parsed = resultJson ? JSON.parse(resultJson as string) : null;

  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(parsed?.dish_name || dishName || '');
  const [editOutput, setEditOutput] = useState(String(parsed?.output || 250));
  const [editCookingTime, setEditCookingTime] = useState(String(parsed?.cooking_time || 20));
  const [editCalories, setEditCalories] = useState(String(parsed?.kbju_per_100g?.calories || 0));
  const [editProteins, setEditProteins] = useState(String(parsed?.kbju_per_100g?.proteins || 0));
  const [editFats, setEditFats] = useState(String(parsed?.kbju_per_100g?.fats || 0));
  const [editCarbs, setEditCarbs] = useState(String(parsed?.kbju_per_100g?.carbs || 0));
  const [editTechnology, setEditTechnology] = useState(parsed?.technology || '');
  const [editIngredients, setEditIngredients] = useState<EditIngredient[]>(
    (parsed?.matched_ingredients?.length || parsed?.unmatched_ingredients?.length
      ? [...(parsed?.matched_ingredients || []), ...(parsed?.unmatched_ingredients || [])]
      : (parsed?.ingredients || [])
    ).map((i: any) => ({
      name: i.item_name || i.name || '',
      quantity: String(i.quantity || 0),
      unit: i.unit || 'г',
    })) || [{ name: '', quantity: '0', unit: 'г' }]
  );

  const updateIng = (idx: number, field: keyof EditIngredient, value: string) => {
    setEditIngredients((prev: EditIngredient[]) => prev.map((ing: EditIngredient, i: number) => i === idx ? { ...ing, [field]: value } : ing));
  };

  const addIng = () => setEditIngredients((prev: EditIngredient[]) => [...prev, { name: '', quantity: '0', unit: 'г' }]);
  const removeIng = (idx: number) => setEditIngredients((prev: EditIngredient[]) => prev.filter((_: EditIngredient, i: number) => i !== idx));

  const handleSave = async () => {
    if (!editName.trim()) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    setSaving(true);
    try {
      const ings = editIngredients.filter((i: EditIngredient) => i.name.trim()).map((i: EditIngredient) => ({
        name: i.name.trim(),
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit,
      }));
      const res = await aiSaveTechCard({
        dish_name: editName.trim(),
        ingredients: ings,
        kbju_per_100g: {
          calories: parseFloat(editCalories) || 0,
          proteins: parseFloat(editProteins) || 0,
          fats: parseFloat(editFats) || 0,
          carbs: parseFloat(editCarbs) || 0,
        },
        output: parseFloat(editOutput) || 250,
        technology: editTechnology,
        cooking_time: parseInt(editCookingTime) || 20,
      });
      const msgs: string[] = [];
      if (res.menuItemCreated) msgs.push('Блюдо создано в меню');
      if (res.createdItems?.length > 0) msgs.push(`Создано ингредиентов: ${res.createdItems.length}`);
      if (res.createdCategories?.length > 0) msgs.push(`Категории: ${res.createdCategories.join(', ')}`);
      Alert.alert('Сохранено!', msgs.join('\n') || 'Техкарта создана');
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setSaving(false); }
  };

  if (!parsed) {
    return (
      <SafeAreaView style={s.center}><Text style={s.emptyText}>Нет данных для сохранения</Text></SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>
          <Text style={s.title}>Редактирование техкарты</Text>

          <Text style={s.fieldLabel}>Название блюда</Text>
          <TextInput value={editName} onChangeText={setEditName} style={s.input} />

          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.fieldLabel}>Выход, г</Text>
              <TextInput value={editOutput} onChangeText={setEditOutput} keyboardType="decimal-pad" style={s.input} />
            </View>
            <View style={s.half}>
              <Text style={s.fieldLabel}>Время, мин</Text>
              <TextInput value={editCookingTime} onChangeText={setEditCookingTime} keyboardType="number-pad" style={s.input} />
            </View>
          </View>

          <Text style={s.sectionTitle}>КБЖУ на 100г</Text>
          <View style={s.row}>
            <View style={s.quarter}><TextInput value={editCalories} onChangeText={setEditCalories} keyboardType="decimal-pad" placeholder="ккал" style={s.inputSmall} /></View>
            <View style={s.quarter}><TextInput value={editProteins} onChangeText={setEditProteins} keyboardType="decimal-pad" placeholder="Белки" style={s.inputSmall} /></View>
            <View style={s.quarter}><TextInput value={editFats} onChangeText={setEditFats} keyboardType="decimal-pad" placeholder="Жиры" style={s.inputSmall} /></View>
            <View style={s.quarter}><TextInput value={editCarbs} onChangeText={setEditCarbs} keyboardType="decimal-pad" placeholder="Угл." style={s.inputSmall} /></View>
          </View>

          <Text style={s.sectionTitle}>Ингредиенты</Text>
          {editIngredients.map((ing, idx) => (
            <View key={idx} style={s.ingRow}>
              <TextInput value={ing.name} onChangeText={t => updateIng(idx, 'name', t)} placeholder="Название" style={s.ingNameInput} />
              <TextInput value={ing.quantity} onChangeText={t => updateIng(idx, 'quantity', t)} keyboardType="decimal-pad" placeholder="0" style={s.ingQtyInput} />
              <TouchableOpacity onPress={() => {
                const units = [...UNITS];
                const cur = units.indexOf(ing.unit);
                updateIng(idx, 'unit', units[(cur + 1) % units.length]);
              }} style={s.unitBtn}><Text style={s.unitText}>{ing.unit}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => removeIng(idx)} style={s.removeBtn}><Text style={s.removeText}>✕</Text></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addIng} style={s.addBtn}><Text style={s.addBtnText}>+ Добавить ингредиент</Text></TouchableOpacity>

          <Text style={s.sectionTitle}>Технология приготовления</Text>
          <TextInput value={editTechnology} onChangeText={setEditTechnology} multiline numberOfLines={6} style={s.techInput} />

          <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveBtn}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={s.saveBtnText}>Сохранить техкарту</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#18181b', marginBottom: 16 },
  emptyText: { color: '#71717a', fontSize: 15 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#18181b', marginBottom: 12 },
  inputSmall: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: '#18181b', marginBottom: 12, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#18181b', marginBottom: 10, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  quarter: { flex: 1 },
  ingRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  ingNameInput: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#18181b' },
  ingQtyInput: { width: 60, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, color: '#18181b', textAlign: 'center' },
  unitBtn: { backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  unitText: { fontSize: 13, fontWeight: '500', color: '#52525b' },
  removeBtn: { padding: 8 },
  removeText: { fontSize: 14, color: '#ef4444' },
  addBtn: { paddingVertical: 8, marginBottom: 4 },
  addBtnText: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  techInput: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#18181b', textAlignVertical: 'top', minHeight: 100 },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
