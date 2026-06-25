import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const UNITS = ['г', 'кг', 'мл', 'л', 'шт'];

interface Props {
  name: string;
  quantity: string;
  unit: string;
  onChange: (field: string, value: string) => void;
  onRemove: () => void;
}

export default function IngredientRow({ name, quantity, unit, onChange, onRemove }: Props) {
  const cycleUnit = () => {
    const idx = UNITS.indexOf(unit);
    onChange('unit', UNITS[(idx + 1) % UNITS.length]);
  };

  return (
    <View style={s.row}>
      <TextInput value={name} onChangeText={t => onChange('name', t)} placeholder="Название" style={s.nameInput} />
      <TextInput value={quantity} onChangeText={t => onChange('quantity', t)} keyboardType="decimal-pad" placeholder="0" style={s.qtyInput} />
      <TouchableOpacity onPress={cycleUnit} style={s.unitBtn}><Text style={s.unitText}>{unit}</Text></TouchableOpacity>
      <TouchableOpacity onPress={onRemove} style={s.removeBtn}><Text style={s.removeText}>✕</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  nameInput: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#18181b' },
  qtyInput: { width: 60, backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, color: '#18181b', textAlign: 'center' },
  unitBtn: { backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  unitText: { fontSize: 13, fontWeight: '500', color: '#52525b' },
  removeBtn: { padding: 8 },
  removeText: { fontSize: 14, color: '#ef4444' },
});
