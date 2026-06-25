import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { aiSaveTechCard } from '../../services/api';

const UNITS = ['г', 'кг', 'мл', 'л', 'шт'];

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export default function ManualScreen() {
  const router = useRouter();
  const [dishName, setDishName] = useState('');
  const [category, setCategory] = useState('Общая');
  const [output, setOutput] = useState('250');
  const [cookingTime, setCookingTime] = useState('20');
  const [calories, setCalories] = useState('0');
  const [proteins, setProteins] = useState('0');
  const [fats, setFats] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [technology, setTechnology] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: 'г' }]);
  const [saving, setSaving] = useState(false);

  const addIngredient = () => setIngredients(prev => [...prev, { name: '', quantity: '', unit: 'г' }]);
  const removeIngredient = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx));
  const updateIngredient = (idx: number, field: keyof Ingredient, value: string) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  };

  const handleSave = async () => {
    if (!dishName.trim()) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    setSaving(true);
    try {
      const ings = ingredients.filter(i => i.name.trim()).map(i => ({
        name: i.name.trim(),
        quantity: parseFloat(i.quantity) || 0,
        unit: i.unit,
      }));
      await aiSaveTechCard({
        dish_name: dishName.trim(),
        menu_category: category,
        ingredients: ings,
        kbju_per_100g: { calories: parseFloat(calories) || 0, proteins: parseFloat(proteins) || 0, fats: parseFloat(fats) || 0, carbs: parseFloat(carbs) || 0 },
        output: parseFloat(output) || 250,
        technology,
        cooking_time: parseInt(cookingTime) || 20,
      });
      Alert.alert('Готово', 'Техкарта создана!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>
          <Text style={s.title}>Ручной ввод</Text>
          <Text style={s.subtitle}>Заполните все поля техкарты</Text>

          <Text style={s.fieldLabel}>Название блюда *</Text>
          <TextInput value={dishName} onChangeText={setDishName} placeholder="Например: Салат Цезарь" style={s.input} />

          <Text style={s.fieldLabel}>Категория</Text>
          <TextInput value={category} onChangeText={setCategory} placeholder="Общая" style={s.input} />

          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.fieldLabel}>Выход, г</Text>
              <TextInput value={output} onChangeText={setOutput} keyboardType="decimal-pad" style={s.input} />
            </View>
            <View style={s.half}>
              <Text style={s.fieldLabel}>Время готовки, мин</Text>
              <TextInput value={cookingTime} onChangeText={setCookingTime} keyboardType="number-pad" style={s.input} />
            </View>
          </View>

          <Text style={s.sectionTitle}>КБЖУ на 100г</Text>
          <View style={s.row}>
            <View style={s.quarter}><TextInput value={calories} onChangeText={setCalories} keyboardType="decimal-pad" placeholder="ккал" style={s.input} /></View>
            <View style={s.quarter}><TextInput value={proteins} onChangeText={setProteins} keyboardType="decimal-pad" placeholder="Белки" style={s.input} /></View>
            <View style={s.quarter}><TextInput value={fats} onChangeText={setFats} keyboardType="decimal-pad" placeholder="Жиры" style={s.input} /></View>
            <View style={s.quarter}><TextInput value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="Углеводы" style={s.input} /></View>
          </View>

          <Text style={s.sectionTitle}>Ингредиенты</Text>
          {ingredients.map((ing, idx) => (
            <View key={idx} style={s.ingRow}>
              <TextInput value={ing.name} onChangeText={t => updateIngredient(idx, 'name', t)} placeholder="Название" style={s.ingNameInput} />
              <TextInput value={ing.quantity} onChangeText={t => updateIngredient(idx, 'quantity', t)} keyboardType="decimal-pad" placeholder="0" style={s.ingQtyInput} />
              <TouchableOpacity onPress={() => {
                const units = [...UNITS];
                const cur = units.indexOf(ing.unit);
                updateIngredient(idx, 'unit', units[(cur + 1) % units.length]);
              }} style={s.unitBtn}><Text style={s.unitText}>{ing.unit}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => removeIngredient(idx)} style={s.removeBtn}><Text style={s.removeText}>✕</Text></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addIngredient} style={s.addBtn}><Text style={s.addBtnText}>+ Добавить ингредиент</Text></TouchableOpacity>

          <Text style={s.sectionTitle}>Технология приготовления</Text>
          <TextInput value={technology} onChangeText={setTechnology} placeholder="Пошаговое описание..." style={s.techInput} multiline numberOfLines={6} />

          <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveBtn}>
            <Text style={s.saveBtnText}>{saving ? 'Сохранение...' : 'Сохранить техкарту'}</Text>
          </TouchableOpacity>
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
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#18181b', marginBottom: 10, marginTop: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#18181b', marginBottom: 12 },
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
  addBtn: { paddingVertical: 10, marginBottom: 4 },
  addBtnText: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  techInput: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#18181b', textAlignVertical: 'top', minHeight: 120 },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
