import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../../services/auth';

export default function VoiceCreateScreen() {
  const { token, refreshProfile } = useAuth();
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const startListening = async () => {
    Alert.alert('Голосовой ввод', 'Говорите... (демо-режим)');
    setIsListening(true);
    setTimeout(() => {
      setTranscript('Салат Цезарь');
      setIsListening(false);
    }, 3000);
  };

  const stopListening = () => {
    setIsListening(false);
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      Alert.alert('Ошибка', 'Сначала произнесите название блюда');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/mobile/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dish_name: transcript.trim() }),
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
          dish_name: result.dish_name || transcript,
          category: result.category || '',
          temperature: result.temperature || '',
          shelf_life: result.shelf_life || '',
          technologist: result.technologist || '_____________________',
          chef: result.chef || '_____________________',
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
        <Text style={styles.title}>Голосовой ввод</Text>
        <View style={{ width: 60 }} />
      </View>

      {!result && (
        <View style={styles.voiceSection}>
          <View style={styles.micContainer}>
            <TouchableOpacity
              style={[styles.micBtn, isListening && styles.micBtnActive]}
              onPress={isListening ? stopListening : startListening}
              disabled={loading}
            >
              <Text style={styles.micIcon}>🎤</Text>
            </TouchableOpacity>
            <Text style={styles.micHint}>
              {isListening ? 'Нажмите, чтобы остановить' : 'Нажмите, чтобы начать запись'}
            </Text>
          </View>

          {transcript ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Распознанный текст:</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          ) : null}

          {transcript && !loading && (
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
              <Text style={styles.generateText}>✨ Сгенерировать техкарту</Text>
            </TouchableOpacity>
          )}

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#e67e22" />
              <Text style={styles.loadingText}>Генерация техкарты...</Text>
            </View>
          )}
        </View>
      )}

      {result && (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>{result.dish_name || transcript}</Text>

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

          {(result.temperature || result.shelf_life) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Условия подачи и хранения</Text>
              {result.temperature ? <View style={styles.metaRow}><Text style={styles.metaLabel}>Температура подачи:</Text><Text style={styles.metaValue}>{result.temperature}</Text></View> : null}
              {result.shelf_life ? <View style={styles.metaRow}><Text style={styles.metaLabel}>Срок годности:</Text><Text style={styles.metaValue}>{result.shelf_life}</Text></View> : null}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setResult(null); setTranscript(''); }}>
              <Text style={styles.cancelText}>Новая запись</Text>
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
  voiceSection: { padding: 20, alignItems: 'center' },
  micContainer: { alignItems: 'center', marginVertical: 40 },
  micBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e67e22', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  micBtnActive: { backgroundColor: '#e74c3c' },
  micIcon: { fontSize: 48 },
  micHint: { fontSize: 14, color: '#666', marginTop: 16, textAlign: 'center' },
  transcriptBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', marginBottom: 16 },
  transcriptLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  transcriptText: { fontSize: 16, color: '#1a1a1a', lineHeight: 22 },
  generateBtn: { backgroundColor: '#e67e22', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' },
  generateText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingBox: { alignItems: 'center', padding: 20 },
  loadingText: { fontSize: 15, color: '#666', marginTop: 12 },
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  metaLabel: { fontSize: 13, color: '#666' },
  metaValue: { fontSize: 13, color: '#333', fontWeight: '500' },
  technology: { fontSize: 14, color: '#444', lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#4caf50', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
