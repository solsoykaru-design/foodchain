import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { api } from '../../services/api';

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    let formatted = '+7';
    if (digits.length > 1) formatted += ` (${digits.slice(1, 4)}`;
    if (digits.length >= 5) formatted += `) ${digits.slice(4, 7)}`;
    if (digits.length >= 8) formatted += `-${digits.slice(7, 9)}`;
    if (digits.length >= 10) formatted += `-${digits.slice(9, 11)}`;
    return formatted;
  };

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 11) {
      Alert.alert('Ошибка', 'Введите полный номер телефона');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/mobile/auth/send-code', { phone: digits });
      router.push({ pathname: '/(auth)/verify', params: { phone: digits } });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <View style={s.content}>
          <Text style={s.logo}>🍽️</Text>
          <Text style={s.title}>AI Техкарты</Text>
          <Text style={s.subtitle}>Войдите или зарегистрируйтесь</Text>

          <Text style={s.label}>Номер телефона</Text>
          <TextInput
            value={phone}
            onChangeText={t => setPhone(formatPhone(t))}
            placeholder="+7 (999) 123-45-67"
            keyboardType="phone-pad"
            style={s.input}
          />

          <TouchableOpacity onPress={handleSendCode} disabled={loading} style={s.button}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Получить код</Text>}
          </TouchableOpacity>

          <Text style={s.hint}>На ваш номер будет отправлен SMS-код для входа</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#18181b', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#71717a', textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: '#18181b', marginBottom: 16, textAlign: 'center' },
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  hint: { fontSize: 12, color: '#a1a1aa', textAlign: 'center', marginTop: 12 },
});
