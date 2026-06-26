import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useAuth, API_URL } from '../../services/auth';

interface TechCard {
  id: number;
  dish_name: string;
  category?: string;
  temperature?: string;
  shelf_life?: string;
  technologist?: string;
  chef?: string;
  ingredients: any[];
  kbju: any;
  output: number;
  technology: string;
  cooking_time: number;
  created_at: string;
}

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const [card, setCard] = useState<TechCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadCard(); }, [id]);

  const loadCard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/tech-cards/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCard(data);
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить техкарту');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!card) return;
    setExporting(true);
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { color: #e67e22; border-bottom: 2px solid #e67e22; padding-bottom: 10px; }
            h2 { color: #333; margin-top: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .kbju { display: flex; gap: 20px; margin: 10px 0; }
            .kbju-item { text-align: center; }
            .kbju-value { font-size: 18px; font-weight: bold; color: #e67e22; }
            .kbju-label { font-size: 10px; color: #666; }
            .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 48px; color: rgba(230, 126, 34, 0.2); font-weight: bold; pointer-events: none; }
            .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
          </style>
        </head>
        <body>
          ${!user?.isSubscribed ? '<div class="watermark">ДЕМО</div>' : ''}
          <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
          <p><strong>Название:</strong> ${card.dish_name}</p>
          <p><strong>Дата:</strong> ${new Date(card.created_at).toLocaleDateString('ru-RU')}</p>
          ${card.category ? `<p><strong>Категория:</strong> ${card.category}</p>` : ''}
          ${card.output > 0 ? `<p><strong>Выход:</strong> ${card.output} г</p>` : ''}
          ${card.cooking_time > 0 ? `<p><strong>Время приготовления:</strong> ${card.cooking_time} мин</p>` : ''}
          ${card.temperature ? `<p><strong>Температура подачи:</strong> ${card.temperature}</p>` : ''}
          ${card.shelf_life ? `<p><strong>Срок годности:</strong> ${card.shelf_life}</p>` : ''}
          
          <h2>Рецептура</h2>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Ингредиент</th>
                <th>Количество</th>
                <th>Ед. изм.</th>
              </tr>
            </thead>
            <tbody>
              ${card.ingredients.map((ing: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${ing.name}</td>
                  <td>${ing.quantity}</td>
                  <td>${ing.unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${card.kbju && (card.kbju.calories || card.kbju.proteins || card.kbju.fats || card.kbju.carbs) ? `
            <h2>Пищевая ценность (на 100г)</h2>
            <div class="kbju">
              <div class="kbju-item">
                <div class="kbju-value">${card.kbju.calories || 0}</div>
                <div class="kbju-label">Ккал</div>
              </div>
              <div class="kbju-item">
                <div class="kbju-value">${card.kbju.proteins || 0}</div>
                <div class="kbju-label">Белки, г</div>
              </div>
              <div class="kbju-item">
                <div class="kbju-value">${card.kbju.fats || 0}</div>
                <div class="kbju-label">Жиры, г</div>
              </div>
              <div class="kbju-item">
                <div class="kbju-value">${card.kbju.carbs || 0}</div>
                <div class="kbju-label">Углеводы, г</div>
              </div>
            </div>
          ` : ''}

          ${card.technology ? `
            <h2>Технология приготовления</h2>
            <p>${card.technology.replace(/\n/g, '<br>')}</p>
          ` : ''}

          <table style="margin-top: 30px; border: none;">
            <tr><td style="border: none; width: 50%;"><strong>Технолог:</strong> ${card.technologist || '_____________________'}</td>
            <td style="border: none;"><strong>Шеф-повар:</strong> ${card.chef || '_____________________'}</td></tr>
          </table>

          <div class="footer">
            <p>Создано в AI Техкарты • ${new Date().toLocaleDateString('ru-RU')}</p>
            ${!user?.isSubscribed ? '<p style="color: #e67e22; font-weight: bold;">Демо-версия. Оформите подписку для PDF без водяных знаков.</p>' : ''}
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      return uri;
    } catch (e: any) {
      Alert.alert('Ошибка', 'Не удалось создать PDF');
      return null;
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    const uri = await generatePDF();
    if (!uri) return;
    
    try {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: card?.dish_name || 'Техкарта',
      });
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось поделиться');
    }
  };

  const handlePrint = async () => {
    const uri = await generatePDF();
    if (!uri) return;
    
    try {
      await Print.printAsync({ uri });
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось распечатать');
    }
  };

  const handleDelete = () => {
    Alert.alert('Удалить техкарту?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: deleteCard },
    ]);
  };

  const deleteCard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/tech-cards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        Alert.alert('Успех', 'Техкарта удалена', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось удалить');
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e67e22" />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>Техкарта не найдена</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Техкарта</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.dishName}>{card.dish_name}</Text>
        <Text style={styles.date}>{new Date(card.created_at).toLocaleDateString('ru-RU')}</Text>

        {card.output > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Выход:</Text>
            <Text style={styles.infoValue}>{card.output} г</Text>
          </View>
        )}

        {card.cooking_time > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Время:</Text>
            <Text style={styles.infoValue}>{card.cooking_time} мин</Text>
          </View>
        )}

        {card.temperature ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Температура подачи:</Text>
            <Text style={styles.infoValue}>{card.temperature}</Text>
          </View>
        ) : null}

        {card.shelf_life ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Срок годности:</Text>
            <Text style={styles.infoValue}>{card.shelf_life}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ингредиенты</Text>
          {card.ingredients.map((ing: any, i: number) => (
            <View key={i} style={styles.ingRow}>
              <Text style={styles.ingName}>{ing.name}</Text>
              <Text style={styles.ingQty}>{ing.quantity} {ing.unit}</Text>
            </View>
          ))}
        </View>

        {card.kbju && (card.kbju.calories || card.kbju.proteins || card.kbju.fats || card.kbju.carbs) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>КБЖУ (на 100г)</Text>
            <View style={styles.kbjuRow}>
              <View style={styles.kbjuItem}>
                <Text style={styles.kbjuValue}>{card.kbju.calories || 0}</Text>
                <Text style={styles.kbjuLabel}>Ккал</Text>
              </View>
              <View style={styles.kbjuItem}>
                <Text style={styles.kbjuValue}>{card.kbju.proteins || 0}</Text>
                <Text style={styles.kbjuLabel}>Белки</Text>
              </View>
              <View style={styles.kbjuItem}>
                <Text style={styles.kbjuValue}>{card.kbju.fats || 0}</Text>
                <Text style={styles.kbjuLabel}>Жиры</Text>
              </View>
              <View style={styles.kbjuItem}>
                <Text style={styles.kbjuValue}>{card.kbju.carbs || 0}</Text>
                <Text style={styles.kbjuLabel}>Углеводы</Text>
              </View>
            </View>
          </View>
        )}

        {card.technology && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Технология приготовления</Text>
            <Text style={styles.technology}>{card.technology}</Text>
          </View>
        )}

        <View style={[styles.section, styles.signSection]}>
          <Text style={styles.sectionTitle}>Подписи</Text>
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>Технолог:</Text>
            <Text style={styles.signValue}>{card.technologist || '_____________________'}</Text>
          </View>
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>Шеф-повар:</Text>
            <Text style={styles.signValue}>{card.chef || '_____________________'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} disabled={exporting}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>Поделиться</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handlePrint} disabled={exporting}>
            <Text style={styles.actionIcon}>🖨️</Text>
            <Text style={styles.actionText}>Печать</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
            <Text style={styles.actionIcon}>🗑️</Text>
            <Text style={styles.actionText}>Удалить</Text>
          </TouchableOpacity>
        </View>

        {!user?.isSubscribed && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>🔒 Демо-версия</Text>
            <Text style={styles.watermarkSubtext}>Оформите подписку для PDF без водяных знаков</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#666', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, color: '#e67e22' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  content: { padding: 16 },
  dishName: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  date: { fontSize: 13, color: '#999', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8 },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  ingName: { fontSize: 14, color: '#333', flex: 1 },
  ingQty: { fontSize: 14, color: '#666', fontWeight: '500' },
  kbjuRow: { flexDirection: 'row', justifyContent: 'space-around' },
  kbjuItem: { alignItems: 'center' },
  kbjuValue: { fontSize: 20, fontWeight: 'bold', color: '#e67e22' },
  kbjuLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  technology: { fontSize: 14, color: '#444', lineHeight: 22 },
  signSection: { padding: 16 },
  signRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  signLabel: { fontSize: 14, color: '#666', width: 100 },
  signValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionText: { fontSize: 12, color: '#333', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#ffebee' },
  watermark: { backgroundColor: '#fff3e0', borderRadius: 12, padding: 16, marginTop: 16, alignItems: 'center' },
  watermarkText: { fontSize: 16, fontWeight: 'bold', color: '#e67e22', marginBottom: 4 },
  watermarkSubtext: { fontSize: 12, color: '#666', textAlign: 'center' },
});
