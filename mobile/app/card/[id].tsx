import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../services/api';
import { generateTechCardPdf } from '../../services/pdf';
import { sharePdf, printPdf } from '../../services/share';

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tc, setTc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    api.get(`/api/mobile/tech-cards/${id}`).then(setTc).catch(() => Alert.alert('Ошибка', 'Не удалось загрузить')).finally(() => setLoading(false));
  }, [id]);

  const handlePdf = async () => {
    if (!tc) return;
    setPdfLoading(true);
    try {
      const uri = await generateTechCardPdf({
        dish_name: tc.dish_name,
        organization: tc.organization,
        category: tc.category,
        ingredients: tc.ingredients,
        kbju: tc.kbju || tc.kbju_per_100g,
        output: tc.output,
        cooking_time: tc.cooking_time,
        technology: tc.technology,
        description: tc.description,
        cost_price: tc.cost_price,
        portions: tc.portions,
        source: tc.source,
      });
      Alert.alert('Готово', 'PDF создан. Хотите открыть?', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Поделиться', onPress: () => sharePdf(uri, `${tc.dish_name}.pdf`) },
        { text: 'Печать', onPress: () => printPdf(uri) },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка PDF', e.message);
    } finally { setPdfLoading(false); }
  };

  const handleShare = async () => {
    if (!tc) return;
    setPdfLoading(true);
    try {
      const uri = await generateTechCardPdf({
        dish_name: tc.dish_name,
        organization: tc.organization,
        ingredients: tc.ingredients,
        kbju: tc.kbju || tc.kbju_per_100g,
        output: tc.output,
        cooking_time: tc.cooking_time,
        technology: tc.technology,
      });
      await sharePdf(uri, `${tc.dish_name}.pdf`);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setPdfLoading(false); }
  };

  const handlePrint = async () => {
    if (!tc) return;
    setPdfLoading(true);
    try {
      const uri = await generateTechCardPdf({
        dish_name: tc.dish_name,
        organization: tc.organization,
        ingredients: tc.ingredients,
        kbju: tc.kbju || tc.kbju_per_100g,
        output: tc.output,
        cooking_time: tc.cooking_time,
        technology: tc.technology,
      });
      await printPdf(uri);
    } catch (e: any) {
      Alert.alert('Ошибка печати', e.message);
    } finally { setPdfLoading(false); }
  };

  const handleDelete = () => {
    Alert.alert('Удалить техкарту', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await api.delete(`/api/mobile/tech-cards/${id}`); router.back(); } catch (e: any) { Alert.alert('Ошибка', e.message); }
      }},
    ]);
  };

  if (loading) return (
    <SafeAreaView style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></SafeAreaView>
  );

  if (!tc) return (
    <SafeAreaView style={s.center}><Text style={s.errorText}>Техкарта не найдена</Text></SafeAreaView>
  );

  const ings = tc.ingredients || [];
  const kbju = tc.kbju || tc.kbju_per_100g || {};

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>

        <View style={s.header}>
          <Text style={s.title}>{tc.dish_name}</Text>
          <View style={s.metaRow}>
            {tc.category ? <Text style={s.meta}>{tc.category}</Text> : null}
            <Text style={s.meta}>Выход: {tc.output || '—'}г</Text>
            <Text style={s.meta}>Время: {tc.cooking_time || '—'} мин</Text>
          </View>
        </View>

        {kbju.calories !== undefined && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>КБЖУ на 100г</Text>
            <View style={s.badgeRow}>
              <View style={s.badge}><Text style={s.badgeText}>🔥 {kbju.calories || 0} ккал</Text></View>
              <View style={s.badge}><Text style={s.badgeText}>Б {kbju.proteins || 0}г</Text></View>
              <View style={s.badge}><Text style={s.badgeText}>Ж {kbju.fats || 0}г</Text></View>
              <View style={s.badge}><Text style={s.badgeText}>У {kbju.carbs || 0}г</Text></View>
            </View>
          </View>
        )}

        {tc.cost_price > 0 && (
          <View style={s.costBox}>
            <Text style={s.costLabel}>Себестоимость</Text>
            <Text style={s.costValue}>{tc.cost_price} ₽</Text>
            {tc.portions > 1 && <Text style={s.costPerPortion}>{tc.cost_price} ₽ / {tc.portions} порц.</Text>}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>Ингредиенты ({ings.length})</Text>
          {ings.length === 0 ? (
            <Text style={s.emptyText}>Нет ингредиентов</Text>
          ) : (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableCell, s.nameCol]}>Название</Text>
                <Text style={[s.tableCell, s.qtyCol, s.textCenter]}>Кол-во</Text>
                <Text style={[s.tableCell, s.unitCol, s.textCenter]}>Ед.</Text>
              </View>
              {ings.map((ing: any, i: number) => (
                <View key={i} style={s.tableRow}>
                  <Text style={[s.tableCell, s.nameCol]}>{ing.item_name || ing.name}</Text>
                  <Text style={[s.tableCell, s.qtyCol, s.textCenter]}>{ing.quantity || 0}</Text>
                  <Text style={[s.tableCell, s.unitCol, s.textCenter]}>{ing.unit || 'г'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {tc.technology ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Технология приготовления</Text>
            <Text style={s.techText}>{tc.technology}</Text>
          </View>
        ) : null}

        {tc.description ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Требования к сырью</Text>
            <Text style={s.techText}>{tc.description}</Text>
          </View>
        ) : null}

        <View style={s.actions}>
          {pdfLoading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={s.loadingText}>Генерация PDF...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={handlePdf} style={s.actionBtn}>
                <Text style={s.actionIcon}>📄</Text>
                <Text style={s.actionLabel}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePrint} style={s.actionBtn}>
                <Text style={s.actionIcon}>🖨️</Text>
                <Text style={s.actionLabel}>Печать</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={s.actionBtn}>
                <Text style={s.actionIcon}>📤</Text>
                <Text style={s.actionLabel}>Поделиться</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push({ pathname: '/save', params: { dishName: tc.dish_name, result: JSON.stringify(tc) } })} style={s.actionBtn}>
                <Text style={s.actionIcon}>✏️</Text>
                <Text style={s.actionLabel}>Править</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={[s.actionBtn, s.deleteBtn]}>
                <Text style={s.actionIcon}>🗑️</Text>
                <Text style={[s.actionLabel, s.deleteLabel]}>Удалить</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
  scroll: { padding: 16, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 14 },
  errorText: { color: '#ef4444', fontSize: 15 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#71717a' },
  section: { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e4e4e7', padding: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { backgroundColor: '#f4f4f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#52525b' },
  costBox: { backgroundColor: '#ecfdf5', borderRadius: 14, borderWidth: 1, borderColor: '#a7f3d0', padding: 16, marginBottom: 12 },
  costLabel: { fontSize: 11, fontWeight: '600', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 },
  costValue: { fontSize: 20, fontWeight: '700', color: '#059669', marginTop: 4 },
  costPerPortion: { fontSize: 12, color: '#059669', marginTop: 2 },
  emptyText: { fontSize: 13, color: '#a1a1aa' },
  table: {},
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f4f4f5', paddingBottom: 6, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#fafafa' },
  tableCell: { fontSize: 13, color: '#52525b' },
  nameCol: { flex: 1 },
  qtyCol: { width: 48 },
  unitCol: { width: 36 },
  textCenter: { textAlign: 'center' },
  techText: { fontSize: 13, color: '#52525b', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  actionBtn: { flex: 1, minWidth: 56, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 10, alignItems: 'center' },
  actionIcon: { fontSize: 20, marginBottom: 2 },
  actionLabel: { fontSize: 10, color: '#52525b' },
  deleteBtn: { borderColor: '#fecaca' },
  deleteLabel: { color: '#ef4444' },
  loadingBox: { flex: 1, alignItems: 'center', padding: 16 },
  loadingText: { fontSize: 11, color: '#71717a', marginTop: 8 },
});
