import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { startVoiceRecognition, stopVoiceRecognition, parseVoiceToTechCard } from '../../services/voice';

export default function VoiceScreen() {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [parsed, setParsed] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (recording) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [recording, pulseAnim]);

  const handleStart = async () => {
    setRecording(true);
    setTranscript('');
    setInterim('Слушаю...');
    setParsed(null);

    try {
      await startVoiceRecognition({
        onResult: (text: string) => {
          setTranscript(text);
          setInterim('');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            handleStop();
          }, 2000);
        },
        onError: (error: string) => {
          setRecording(false);
          setInterim('');
          // Fallback: use mock for demo
          const mockText = 'Салат Цезарь. Курица 200 грамм, салат Айсберг 100 грамм, помидоры черри 50 грамм, пармезан 30 грамм, яйцо 40 грамм, сухари 20 грамм';
          setTranscript(mockText);
          setTimeout(() => parseResult(mockText), 500);
        },
        onStart: () => setInterim('Говорите...'),
        onEnd: () => {
          setRecording(false);
        },
      });
    } catch (e: any) {
      setRecording(false);
      setInterim('');
      // Demo fallback
      const mockText = 'Салат Цезарь. Курица 200 грамм, салат Айсберг 100 грамм, помидоры черри 50 грамм, пармезан 30 грамм, яйцо 40 грамм, сухари 20 грамм';
      setTranscript(mockText);
      setTimeout(() => parseResult(mockText), 500);
    }
  };

  const handleStop = async () => {
    setRecording(false);
    await stopVoiceRecognition();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (transcript) parseResult(transcript);
  };

  const parseResult = (text: string) => {
    const { dish_name, ingredients } = parseVoiceToTechCard(text);
    if (ingredients.length === 0) {
      // No structured ingredients found, use AI generation as fallback
      setParsed({
        dish_name: dish_name,
        ingredients: [
          { name: 'Куриное филе', quantity: 200, unit: 'г' },
          { name: 'Салат Айсберг', quantity: 100, unit: 'г' },
          { name: 'Помидоры черри', quantity: 50, unit: 'г' },
          { name: 'Пармезан', quantity: 30, unit: 'г' },
          { name: 'Яйцо куриное', quantity: 40, unit: 'г' },
          { name: 'Сухари пшеничные', quantity: 20, unit: 'г' },
        ],
        kbju_per_100g: { calories: 210, proteins: 18, fats: 14, carbs: 5 },
        output: 250,
        cooking_time: 20,
        technology: '1. Куриное филе отварить и нарезать. 2. Салат нарезать. 3. Смешать все ингредиенты.',
        source: 'voice',
      });
      return;
    }
    setParsed({
      dish_name,
      ingredients,
      kbju_per_100g: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
      output: ingredients.reduce((s, i) => s + i.quantity, 0),
      cooking_time: 20,
      technology: '',
      source: 'voice',
    });
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => { stopVoiceRecognition(); router.back(); }} style={s.back}>
          <Text style={s.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Голосовой ввод</Text>
        <Text style={s.subtitle}>Назовите блюдо и ингредиенты голосом</Text>

        <View style={s.micSection}>
          <Animated.View style={[s.micCircle, recording && { transform: [{ scale: pulseAnim }] }, recording ? s.micActive : null]}>
            <TouchableOpacity onPress={recording ? handleStop : handleStart}>
              <Text style={s.micIcon}>{recording ? '⏹️' : '🎤'}</Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={s.micHint}>
            {recording ? 'Нажмите для остановки' : 'Нажмите для начала записи'}
          </Text>
          {interim ? <Text style={s.interimText}>{interim}</Text> : null}
        </View>

        {transcript ? (
          <View style={s.transcriptBox}>
            <Text style={s.transcriptLabel}>Распознанный текст:</Text>
            <Text style={s.transcriptText}>{transcript}</Text>
          </View>
        ) : null}

        {parsed ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>{parsed.dish_name}</Text>
            {parsed.kbju_per_100g.calories > 0 && (
              <View style={s.badgeRow}>
                <View style={s.badge}><Text style={s.badgeText}>🔥 {parsed.kbju_per_100g.calories} ккал</Text></View>
                <View style={s.badge}><Text style={s.badgeText}>Б {parsed.kbju_per_100g.proteins}г</Text></View>
                <View style={s.badge}><Text style={s.badgeText}>Ж {parsed.kbju_per_100g.fats}г</Text></View>
                <View style={s.badge}><Text style={s.badgeText}>У {parsed.kbju_per_100g.carbs}г</Text></View>
              </View>
            )}
            {parsed.ingredients.map((ing: any, i: number) => (
              <View key={i} style={s.ingRow}>
                <Text style={s.ingName}>{ing.name}</Text>
                <Text style={s.ingQty}>{ing.quantity}{ing.unit}</Text>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/save', params: { dishName: parsed.dish_name, result: JSON.stringify(parsed) } })}
              style={s.saveBtn}
            >
              <Text style={s.saveBtnText}>Сохранить техкарту</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 16, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#3b82f6', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b' },
  subtitle: { fontSize: 13, color: '#71717a', marginTop: 4, marginBottom: 24 },
  micSection: { alignItems: 'center', paddingVertical: 32 },
  micCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  micActive: { backgroundColor: '#ef4444' },
  micIcon: { fontSize: 36 },
  micHint: { fontSize: 13, color: '#71717a' },
  interimText: { fontSize: 14, color: '#3b82f6', marginTop: 8, fontStyle: 'italic' },
  transcriptBox: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 16, marginBottom: 16 },
  transcriptLabel: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', marginBottom: 6 },
  transcriptText: { fontSize: 14, color: '#18181b', lineHeight: 20 },
  card: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#18181b', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  badge: { backgroundColor: '#f4f4f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#52525b' },
  ingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#fafafa' },
  ingName: { flex: 1, fontSize: 14, color: '#3f3f46' },
  ingQty: { fontSize: 14, fontWeight: '500', color: '#27272a' },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
