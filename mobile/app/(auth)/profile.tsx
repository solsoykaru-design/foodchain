import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/auth';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Ошибка', 'Введите имя'); return; }
    setLoading(true);
    try {
      const { api } = await import('../../services/api');
      await api.put('/api/mobile/profile', { name: name.trim(), organization: org.trim() });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <View style={s.content}>
          <Text style={s.emoji}>👋</Text>
          <Text style={s.title}>Заполните профиль</Text>
          <Text style={s.subtitle}>Это поможет формировать шапку техкарт</Text>

          <Text style={s.label}>Имя *</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Иван Петров" style={s.input} />

          <Text style={s.label}>Организация</Text>
          <TextInput value={org} onChangeText={setOrg} placeholder="ООО Ресторан «Вкусно»" style={s.input} />

          <TouchableOpacity onPress={handleSave} disabled={loading} style={s.button}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>Сохранить</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={s.skipBtn}>
            <Text style={s.skipText}>Пропустить</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#18181b', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#71717a', textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#18181b', marginBottom: 16 },
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  skipBtn: { alignItems: 'center', marginTop: 16 },
  skipText: { color: '#71717a', fontSize: 14 },
});
