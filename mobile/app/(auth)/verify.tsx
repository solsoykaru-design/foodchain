import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../services/auth';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const { signIn } = useAuth();
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const t = setInterval(() => setTimer(p => p - 1), 1000);
      return () => clearInterval(t);
    }
  }, [timer]);

  const handleCodeChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(0, 1);
    const newCode = [...code];
    newCode[idx] = digit;
    setCode(newCode);
    if (digit && idx < 3) inputRefs.current[idx + 1]?.focus();
    if (idx === 3 && digit) handleVerify(newCode.join(''));
  };

  const handleVerify = async (fullCode?: string) => {
    const c = fullCode || code.join('');
    if (c.length < 4) return;
    setLoading(true);
    try {
      await signIn(phone!, c);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { api } = await import('../../services/api');
      await api.post('/api/mobile/auth/send-code', { phone });
      setTimer(60);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>
        <Text style={s.title}>Подтверждение</Text>
        <Text style={s.subtitle}>Код отправлен на +7 {phone?.slice(1, 4)} ***-**-{phone?.slice(-2)}</Text>

        <View style={s.codeRow}>
          {code.map((d, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref!; }}
              value={d}
              onChangeText={t => handleCodeChange(t, i)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !d && i > 0) {
                  inputRefs.current[i - 1]?.focus();
                }
              }}
              style={[s.codeInput, d ? s.codeInputFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
            />
          ))}
        </View>

        {loading && <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 16 }} />}

        <TouchableOpacity onPress={handleResend} disabled={timer > 0} style={s.resendBtn}>
          <Text style={[s.resendText, timer > 0 && s.resendDisabled]}>
            {timer > 0 ? `Отправить повторно через ${timer}с` : 'Отправить повторно'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  back: { position: 'absolute', top: 16, left: 24 },
  backText: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 26, fontWeight: '700', color: '#18181b', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#71717a', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  codeInput: { width: 56, height: 64, backgroundColor: 'white', borderWidth: 2, borderColor: '#e4e4e7', borderRadius: 12, textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#18181b' },
  codeInputFilled: { borderColor: '#3b82f6' },
  resendBtn: { alignItems: 'center', marginTop: 24 },
  resendText: { color: '#3b82f6', fontSize: 14 },
  resendDisabled: { color: '#a1a1aa' },
});
