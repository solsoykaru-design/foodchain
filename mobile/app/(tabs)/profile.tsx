import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../../services/auth';

export default function ProfileScreen() {
  const { user, token, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || '');
  const [promoCode, setPromoCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        await refreshProfile();
        Alert.alert('Успех', 'Профиль обновлён');
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) { Alert.alert('Ошибка', 'Введите промокод'); return; }
    try {
      const res = await fetch(`${API_URL}/api/mobile/promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      await refreshProfile();
      Alert.alert('Успех', data.message || 'Промокод применён');
      setPromoCode('');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const handleApplyReferral = async () => {
    if (!referralCode.trim()) { Alert.alert('Ошибка', 'Введите реферальный код'); return; }
    try {
      const res = await fetch(`${API_URL}/api/mobile/referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ referralCode: referralCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      await refreshProfile();
      Alert.alert('Успех', data.message || 'Реферальный код применён');
      setReferralCode('');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Профиль</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.phone}>{user?.phone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Имя</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ваше имя" placeholderTextColor="#999" />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? '...' : 'Сохранить'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Статус подписки</Text>
          {user?.isSubscribed ? (
            <View style={styles.subActive}>
              <Text style={styles.subIcon}>✅</Text>
              <Text style={styles.subText}>Подписка активна</Text>
              {user.tariffUntil && (
                <Text style={styles.subUntil}>до {new Date(user.tariffUntil).toLocaleDateString('ru-RU')}</Text>
              )}
            </View>
          ) : (
            <View style={styles.subFree}>
              <Text style={styles.subIcon}>🎯</Text>
              <Text style={styles.subText}>Бесплатный тариф</Text>
              <Text style={styles.subAttempts}>Попыток: {user?.freeAttempts || 0}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.subBtn} onPress={() => router.push('/subscription')}>
            <Text style={styles.subBtnText}>💎 Управление подпиской</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Промокод</Text>
          <TextInput style={styles.input} value={promoCode} onChangeText={setPromoCode} placeholder="Введите промокод" placeholderTextColor="#999" autoCapitalize="characters" />
          <TouchableOpacity style={styles.promoBtn} onPress={handleApplyPromo}>
            <Text style={styles.promoText}>Применить</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Реферальная программа</Text>
          <Text style={styles.refInfo}>Пригласите друга — оба получите +3 попытки!</Text>
          {user?.referralCode && (
            <View style={styles.refCodeBox}>
              <Text style={styles.refLabel}>Ваш код:</Text>
              <Text style={styles.refCode}>{user.referralCode}</Text>
            </View>
          )}
          <TextInput style={styles.input} value={referralCode} onChangeText={setReferralCode} placeholder="Код друга" placeholderTextColor="#999" autoCapitalize="characters" />
          <TouchableOpacity style={styles.refBtn} onPress={handleApplyReferral}>
            <Text style={styles.refBtnText}>Применить код друга</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, color: '#e67e22' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  content: { padding: 16 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 40 },
  phone: { fontSize: 16, color: '#666' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 12 },
  saveBtn: { backgroundColor: '#e67e22', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  subActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12 },
  subFree: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', borderRadius: 10, padding: 12, marginBottom: 12 },
  subIcon: { fontSize: 24, marginRight: 12 },
  subText: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  subUntil: { fontSize: 12, color: '#666' },
  subAttempts: { fontSize: 14, color: '#e67e22', fontWeight: 'bold' },
  subBtn: { backgroundColor: '#e67e22', borderRadius: 10, padding: 12, alignItems: 'center' },
  subBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  refInfo: { fontSize: 13, color: '#666', marginBottom: 12 },
  refCodeBox: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  refLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  refCode: { fontSize: 20, fontWeight: 'bold', color: '#e67e22', letterSpacing: 2 },
  promoBtn: { backgroundColor: '#2196f3', borderRadius: 10, padding: 12, alignItems: 'center' },
  promoText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  refBtn: { backgroundColor: '#4caf50', borderRadius: 10, padding: 12, alignItems: 'center' },
  refBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutBtn: { backgroundColor: '#ffebee', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#e74c3c', fontSize: 15, fontWeight: '600' },
});
