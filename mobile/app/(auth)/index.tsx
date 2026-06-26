import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../services/auth';

export default function LoginScreen() {
  const { login, register, verifyRegister, forgotPassword, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoPresses, setLogoPresses] = useState(0);
  const logoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoPress = () => {
    setLogoPresses(p => p + 1);
    if (logoTimer.current) clearTimeout(logoTimer.current);
    logoTimer.current = setTimeout(() => setLogoPresses(0), 2000);
    if (logoPresses >= 4) {
      setLogoPresses(0);
      Alert.prompt?.('Вход суперадмина', 'Логин:', (loginName: string) => {
        Alert.prompt?.('Пароль', '', async (pass: string) => {
          if (loginName === 'admin' && pass === 'admin123') {
            Alert.alert('Вход суперадмина', 'Доступ получен');
          } else {
            Alert.alert('Ошибка', 'Неверные данные');
          }
        }, 'secure-text');
      });
    }
  };

  const handleLogin = async () => {
    if (!phone || !password) { Alert.alert('Ошибка', 'Заполните все поля'); return; }
    setLoading(true);
    try {
      await login(phone, password);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!phone || !password) { Alert.alert('Ошибка', 'Заполните все поля'); return; }
    if (password.length < 6) { Alert.alert('Ошибка', 'Пароль минимум 6 символов'); return; }
    if (password !== confirmPassword) { Alert.alert('Ошибка', 'Пароли не совпадают'); return; }
    setLoading(true);
    try {
      const c = await register(phone, password);
      setDebugCode(c);
      setMode('verify');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code) { Alert.alert('Ошибка', 'Введите код'); return; }
    setLoading(true);
    try {
      await verifyRegister(phone, code, password);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!phone) { Alert.alert('Ошибка', 'Введите номер телефона'); return; }
    setLoading(true);
    try {
      const c = await forgotPassword(phone);
      setDebugCode(c);
      setMode('reset');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code || !password) { Alert.alert('Ошибка', 'Заполните все поля'); return; }
    if (password.length < 6) { Alert.alert('Ошибка', 'Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      await resetPassword(phone, code, password);
      Alert.alert('Успех', 'Пароль изменён', [{ text: 'OK', onPress: () => setMode('login') }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onLongPress={handleLogoPress} style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🍳</Text>
        <Text style={styles.logoText}>AI Техкарты</Text>
        <Text style={styles.logoSubtext}>Создание ТТК с помощью AI</Text>
      </TouchableOpacity>

      {mode === 'login' && (
        <View style={styles.form}>
          <Text style={styles.title}>Вход</Text>
          <TextInput style={styles.input} placeholder="+7 (999) 123-45-67" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Пароль" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#999" />
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : 'Войти'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('register')} style={styles.link}>
            <Text style={styles.linkText}>Зарегистрироваться</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('forgot')} style={styles.link}>
            <Text style={styles.linkTextSmall}>Забыли пароль?</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'register' && (
        <View style={styles.form}>
          <Text style={styles.title}>Регистрация</Text>
          <TextInput style={styles.input} placeholder="+7 (999) 123-45-67" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Пароль (мин. 6 символов)" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Повторите пароль" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor="#999" />
          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : 'Получить код'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('login')} style={styles.link}>
            <Text style={styles.linkText}>Уже есть аккаунт? Войти</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'verify' && (
        <View style={styles.form}>
          <Text style={styles.title}>Подтверждение</Text>
          <Text style={styles.subtitle}>Код отправлен на {phone}</Text>
          {debugCode ? <Text style={styles.debugCode}>Код (dev): {debugCode}</Text> : null}
          <TextInput style={styles.input} placeholder="Введите код" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholderTextColor="#999" />
          <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : 'Подтвердить'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('register')} style={styles.link}>
            <Text style={styles.linkText}>Назад</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'forgot' && (
        <View style={styles.form}>
          <Text style={styles.title}>Восстановление пароля</Text>
          <TextInput style={styles.input} placeholder="+7 (999) 123-45-67" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#999" />
          <TouchableOpacity style={styles.button} onPress={handleForgot} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : 'Получить код'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('login')} style={styles.link}>
            <Text style={styles.linkText}>Назад</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'reset' && (
        <View style={styles.form}>
          <Text style={styles.title}>Новый пароль</Text>
          {debugCode ? <Text style={styles.debugCode}>Код (dev): {debugCode}</Text> : null}
          <TextInput style={styles.input} placeholder="Код из SMS" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Новый пароль" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#999" />
          <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : 'Сменить пароль'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('login')} style={styles.link}>
            <Text style={styles.linkText}>Назад</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 64 },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a', marginTop: 8 },
  logoSubtext: { fontSize: 14, color: '#666', marginTop: 4 },
  form: { gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  debugCode: { fontSize: 14, color: '#e67e22', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fef3e2', padding: 8, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#f9f9f9' },
  button: { backgroundColor: '#e67e22', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { alignItems: 'center', padding: 8 },
  linkText: { color: '#e67e22', fontSize: 15, fontWeight: '600' },
  linkTextSmall: { color: '#999', fontSize: 13 },
});
