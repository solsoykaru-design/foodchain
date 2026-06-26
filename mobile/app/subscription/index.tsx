import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useAuth, API_URL } from '../../services/auth';

interface Tariff {
  key: string;
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
  economy?: string;
}

const TARIFFS: Tariff[] = [
  {
    key: 'month',
    name: '1 месяц',
    price: 299,
    features: ['Неограниченные техкарты', 'Голосовой ввод', 'PDF без водяных знаков'],
  },
  {
    key: 'quarter',
    name: '3 месяца',
    price: 599,
    popular: true,
    economy: 'Экономия 33%',
    features: ['Всё из тарифа "1 месяц"', 'Приоритетная поддержка', 'Ранний доступ к функциям'],
  },
  {
    key: 'year',
    name: '12 месяцев',
    price: 1499,
    economy: 'Экономия 58%',
    features: ['Всё из тарифа "3 месяца"', 'Доступ к бета-функциям', 'Скидка на обновления'],
  },
];

export default function SubscriptionScreen() {
  const { user, token, refreshProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubscribe = async (tariffKey: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/payments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tariff: tariffKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания платежа');
      setPayment(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (tariffKey: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/payments/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tariff: tariffKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка подтверждения');
      
      await refreshProfile();
      Alert.alert('Успех', 'Подписка активирована!', [{ text: 'OK', onPress: () => { setPayment(null); router.back(); } }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setProcessing(false);
    }
  };

  const openPaymentLink = () => {
    if (payment?.sbpPayload) {
      Linking.openURL(payment.sbpPayload);
    }
  };

  if (payment) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPayment(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Оплата</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.paymentContent}>
          <Text style={styles.paymentTitle}>Оплата подписки</Text>
          <Text style={styles.paymentAmount}>{payment.amount} ₽</Text>
          <Text style={styles.paymentTariff}>{payment.tariffName}</Text>

          <View style={styles.qrContainer}>
            <QRCode value={payment.qrData} size={200} />
            <Text style={styles.qrHint}>Отсканируйте QR-код в приложении банка</Text>
          </View>

          <View style={styles.paymentDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Получатель:</Text>
              <Text style={styles.detailValue}>{payment.recipientPhone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Банк:</Text>
              <Text style={styles.detailValue}>{payment.recipientBank}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Назначение:</Text>
              <Text style={styles.detailValue}>{payment.purpose}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.payBtn} onPress={openPaymentLink}>
            <Text style={styles.payBtnText}>💳 Открыть в приложении банка</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, processing && styles.confirmBtnDisabled]}
            onPress={() => handleConfirmPayment(payment.tariff)}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>✅ Я оплатил</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Подписка</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {user?.isSubscribed ? (
          <View style={styles.activeSub}>
            <Text style={styles.activeIcon}>✅</Text>
            <Text style={styles.activeTitle}>Подписка активна</Text>
            {user.tariffUntil && (
              <Text style={styles.activeUntil}>
                Действует до {new Date(user.tariffUntil).toLocaleDateString('ru-RU')}
              </Text>
            )}
          </View>
        ) : (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>🎯 Бесплатные попытки</Text>
              <Text style={styles.infoText}>
                Осталось: <Text style={styles.infoCount}>{user?.freeAttempts || 0}</Text>
              </Text>
              <Text style={styles.infoSubtext}>Оформите подписку для безлимитного доступа</Text>
            </View>

            <Text style={styles.sectionTitle}>Выберите тариф</Text>

            {TARIFFS.map((tariff) => (
              <TouchableOpacity
                key={tariff.key}
                style={[styles.tariffCard, tariff.popular && styles.tariffPopular]}
                onPress={() => handleSubscribe(tariff.key)}
                disabled={loading}
              >
                {tariff.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>🔥 Самый популярный</Text>
                  </View>
                )}
                {tariff.economy && (
                  <View style={styles.economyBadge}>
                    <Text style={styles.economyText}>{tariff.economy}</Text>
                  </View>
                )}
                <Text style={styles.tariffName}>{tariff.name}</Text>
                <Text style={styles.tariffPrice}>{tariff.price} ₽</Text>
                <View style={styles.features}>
                  {tariff.features.map((feature, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Text style={styles.featureCheck}>✓</Text>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.subscribeBtn}
                  onPress={() => handleSubscribe(tariff.key)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.subscribeText}>Оформить</Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}
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
  activeSub: { backgroundColor: '#e8f5e9', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  activeIcon: { fontSize: 48, marginBottom: 12 },
  activeTitle: { fontSize: 20, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 },
  activeUntil: { fontSize: 14, color: '#666' },
  infoBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#666' },
  infoCount: { fontSize: 20, fontWeight: 'bold', color: '#e67e22' },
  infoSubtext: { fontSize: 12, color: '#999', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  tariffCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  tariffPopular: { borderColor: '#e67e22' },
  popularBadge: { backgroundColor: '#e67e22', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, alignSelf: 'flex-start', marginBottom: 8 },
  popularText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  economyBadge: { backgroundColor: '#4caf50', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, alignSelf: 'flex-start', marginBottom: 8 },
  economyText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  tariffName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  tariffPrice: { fontSize: 28, fontWeight: 'bold', color: '#e67e22', marginBottom: 12 },
  features: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  featureCheck: { fontSize: 16, color: '#4caf50', marginRight: 8, fontWeight: 'bold' },
  featureText: { fontSize: 14, color: '#333', flex: 1 },
  subscribeBtn: { backgroundColor: '#e67e22', borderRadius: 12, padding: 14, alignItems: 'center' },
  subscribeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  paymentContent: { padding: 20, alignItems: 'center' },
  paymentTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  paymentAmount: { fontSize: 36, fontWeight: 'bold', color: '#e67e22', marginBottom: 4 },
  paymentTariff: { fontSize: 16, color: '#666', marginBottom: 24 },
  qrContainer: { alignItems: 'center', marginBottom: 24 },
  qrHint: { fontSize: 12, color: '#666', marginTop: 12, textAlign: 'center' },
  paymentDetails: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailLabel: { fontSize: 13, color: '#666' },
  detailValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
  payBtn: { backgroundColor: '#2196f3', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center', marginBottom: 12 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#4caf50', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
