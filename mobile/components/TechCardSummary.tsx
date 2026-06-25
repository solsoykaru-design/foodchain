import { View, Text, StyleSheet } from 'react-native';

interface Props {
  dishName: string;
  output?: number;
  cookingTime?: number;
  kbju?: { calories?: number; proteins?: number; fats?: number; carbs?: number };
  ingredientCount?: number;
  source?: string;
}

export default function TechCardSummary({ dishName, output, cookingTime, kbju, ingredientCount, source }: Props) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>{dishName}</Text>
        {source && <Text style={s.source}>{source}</Text>}
      </View>
      <View style={s.stats}>
        {kbju && (
          <View style={s.kbjuRow}>
            <Text style={s.kbjuItem}>🔥 {kbju.calories || 0} ккал</Text>
            <Text style={s.kbjuItem}>Б {kbju.proteins || 0}г</Text>
            <Text style={s.kbjuItem}>Ж {kbju.fats || 0}г</Text>
            <Text style={s.kbjuItem}>У {kbju.carbs || 0}г</Text>
          </View>
        )}
        <View style={s.infoRow}>
          {output ? <Text style={s.info}>Выход: {output}г</Text> : null}
          {cookingTime ? <Text style={s.info}>Время: {cookingTime} мин</Text> : null}
          {ingredientCount ? <Text style={s.info}>Ингр.: {ingredientCount}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e4e4e7', overflow: 'hidden' },
  header: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  title: { fontSize: 16, fontWeight: '700', color: '#18181b' },
  source: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  stats: { padding: 14 },
  kbjuRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  kbjuItem: { fontSize: 12, fontWeight: '500', color: '#52525b', backgroundColor: '#f4f4f5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  infoRow: { flexDirection: 'row', gap: 12 },
  info: { fontSize: 12, color: '#71717a' },
});
