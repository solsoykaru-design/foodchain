import { View, Text, TextInput, StyleSheet } from 'react-native';

interface Props {
  calories: string;
  proteins: string;
  fats: string;
  carbs: string;
  onChange: (field: string, value: string) => void;
}

export default function KBJUInput({ calories, proteins, fats, carbs, onChange }: Props) {
  return (
    <View>
      <Text style={s.label}>КБЖУ на 100г</Text>
      <View style={s.row}>
        <View style={s.field}><TextInput value={calories} onChangeText={t => onChange('calories', t)} keyboardType="decimal-pad" placeholder="ккал" style={s.input} /></View>
        <View style={s.field}><TextInput value={proteins} onChangeText={t => onChange('proteins', t)} keyboardType="decimal-pad" placeholder="Белки" style={s.input} /></View>
        <View style={s.field}><TextInput value={fats} onChangeText={t => onChange('fats', t)} keyboardType="decimal-pad" placeholder="Жиры" style={s.input} /></View>
        <View style={s.field}><TextInput value={carbs} onChangeText={t => onChange('carbs', t)} keyboardType="decimal-pad" placeholder="Угл." style={s.input} /></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  field: { flex: 1 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 10, fontSize: 13, color: '#18181b', textAlign: 'center' },
});
