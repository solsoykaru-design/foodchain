import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../../services/auth';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export default function ManualCreateScreen() {
  const { token, refreshProfile } = useAuth();
  const router = useRouter();
  const [dishName, setDishName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: 'г' }]);
  const [output, setOutput] = useState('');
  const [technology, setTechnology] = useState('');
  const [cookingTime, setCookingTime] = useState('');
  const [calories, setCalories] = useState('');
  const [proteins, setProteins] = useState('');
  const [fats, setFats] = useState('');
  const [carbs, setCarbs] = useState('');
  const [saving, setSaving] = useState(false);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: 'г' }]);
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dishName.trim()) { Alert.alert('Ошибка', 'Введите название блюда'); return; }
    const validIngs = ingredients.filter(i => i.name.trim());
    if (validIngs.length === 0) { Alert.alert('Ошибка', 'Добавьте хотя бы один ингредиент'); return; }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/tech-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dish_name: dishName.trim(),
          ingredients: validIngs.map(i => ({ name: i.name, quantity: parseFloat(i.quantity) || 0, unit: i.unit })),
          kbju: { calories: parseFloat(calories) || 0, proteins: parseFloat(proteins) || 0, fats: parseFloat(fats) || 0, carbs: parseFloat(carbs) || 0 },
          output: parseFloat(output) || 0,
          technology: technology.trim(),
          cooking_time: parseInt(cookingTime) || 0,
          source: 'manual',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
      
      await refreshProfile();
      Alert.alert('Успех', 'Техкарта создана!', [{ text: 'OK', onPress: () => router.back() }]);
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
        <Text style={styles.title}>Ручной ввод</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Название блюда *</Text>
        <TextInput style={styles.input} placeholder="Например: Салат Цезарь" value={dishName} onChangeText={setDishName} placeholderTextColor="#999" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ингредиенты *</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingRow}>
            <TextInput style={[styles.input, styles.ingName]} placeholder="Название" value={ing.name} onChangeText={v => updateIngredient(i, 'name', v)} placeholderTextColor="#999" />
            <TextInput style={[styles.input, styles.ingQty]} placeholder="Кол-во" value={ing.quantity} onChangeText={v => updateIngredient(i, 'quantity', v)} keyboardType="decimal-pad" placeholderTextColor="#999" />
            <TouchableOpacity style={styles.unitBtn} onPress={() => {
              const units = ['г', 'кг', 'мл', 'л', 'шт'];
              const idx = units.indexOf(ing.unit);
              updateIngredient(i, 'unit', units[(idx + 1) % units.length]);
            }}>
              <Text style={styles.unitText}>{ing.unit}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
          <Text style={styles.addText}>+ Добавить ингредиент</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Выход блюда (г)</Text>
        <TextInput style={styles.input} placeholder="300" value={output} onChangeText={setOutput} keyboardType="decimal-pad" placeholderTextColor="#999" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>КБЖУ (на 100г)</Text>
        <View style={styles.kbjuRow}>
          <View style={styles.kbjuInput}>
            <Text style={styles.kbjuLabel}>Ккал</Text>
            <TextInput style={styles.input} placeholder="0" value={calories} onChangeText={setCalories} keyboardType="decimal-pad" placeholderTextColor="#999" />
          </View>
          <View style={styles.kbjuInput}>
            <Text style={styles.kbjuLabel}>Белки</Text>
            <TextInput style={styles.input} placeholder="0" value={proteins} onChangeText={setProteins} keyboardType="decimal-pad" placeholderTextColor="#999" />
          </View>
          <View style={styles.kbjuInput}>
            <Text style={styles.kbjuLabel}>Жиры</Text>
            <TextInput style={styles.input} placeholder="0" value={fats} onChangeText={setFats} keyboardType="decimal-pad" placeholderTextColor="#999" />
          </View>
          <View style={styles.kbjuInput}>
            <Text style={styles.kbjuLabel}>Углеводы</Text>
            <TextInput style={styles.input} placeholder="0" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholderTextColor="#999" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Время приготовления (мин)</Text>
        <TextInput style={styles.input} placeholder="30" value={cookingTime} onChangeText={setCookingTime} keyboardType="number-pad" placeholderTextColor="#999" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Технология приготовления</Text>
        <TextInput style={[styles.input, styles.textarea]} placeholder="Опишите пошагово..." value={technology} onChangeText={setTechnology} multiline numberOfLines={6} placeholderTextColor="#999" textAlignVertical="top" />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Сохранение...' : '💾 Сохранить техкарту'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, color: '#e67e22' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  section: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  textarea: { height: 120 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ingName: { flex: 2 },
  ingQty: { flex: 1, width: 70 },
  unitBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, backgroundColor: '#f0f0f0', minWidth: 45, alignItems: 'center' },
  unitText: { fontSize: 14, fontWeight: '600', color: '#666' },
  removeBtn: { padding: 8 },
  removeText: { fontSize: 18, color: '#e74c3c' },
  addBtn: { borderWidth: 1, borderColor: '#e67e22', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  addText: { color: '#e67e22', fontSize: 14, fontWeight: '600' },
  kbjuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kbjuInput: { flex: 1, minWidth: 70 },
  kbjuLabel: { fontSize: 12, color: '#666', marginBottom: 4, textAlign: 'center' },
  saveBtn: { backgroundColor: '#4caf50', margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
