import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Linking, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useAuth } from '../../services/auth';

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width - 80, 280);

let QRCode: any = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {}

const PLAN_PRICES: Record<string, { name: string; price: number }> = {
  pro: { name: 'Профессиональный', price: 990 },
  business: { name: 'Бизнес', price: 2990 },
};

export default function PaymentScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const pollRef = useRef<any>(null);

  const plan = PLAN_PRICES[planId || ''];

  if (!plan) {
    return (
      <SafeAreaView style={s.center}><Text style={s.errorText}>Тариф не найден</Text></SafeAreaView>
    );
  }

  const startPolling = (paymentId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.get(`/api/mobile/payments/${paymentId}/status`);
        if (status.status === 'paid') {
          clearInterval(pollRef.current);
          await refresh();
          Alert.alert('Оплачено!', 'Подписка активирована', [{ text: 'OK', onPress: () => router.back() }]);
        }
      } catch {}
    }, 5000);
  };

  const handleCreatePayment = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/mobile/payments/create', { tariff: planId });
      setPaymentData(data);
      startPolling(data.paymentId);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
      setLoading(false);
    }
  };

  const handlePaySberbank = () => {
    if (!paymentData?.paymentUrl) return;
    Linking.openURL(paymentData.paymentUrl).catch(() => {
      Alert.alert('Ошибка', 'Не удалось открыть Сбербанк');
    });
  };

  const handlePayManual = () => {
    Alert.alert(
      'Подтверждение оплаты',
      `Переведите ${plan.price} ₽ на номер Сбербанк:\n\n+${paymentData?.recipientPhone || '7 (977) 947-5605'}\n\nПосле перевода нажмите «Я оплатил». Мы проверим платеж и активируем подписку.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Я оплатил',
          onPress: async () => {
            try {
              await api.post('/api/mobile/payments/webhook', {
                paymentId: paymentData.paymentId,
                status: 'success',
              });
              await refresh();
              Alert.alert('Проверяем...', 'Подписка будет активирована после подтверждения платежа');
            } catch (e: any) {
              Alert.alert('Ошибка', e.message);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPaymentData(null);
    setLoading(false);
  };

  if (!paymentData) {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>

          <View style={s.planInfo}>
            <Text style={s.planName}>{plan.name}</Text>
            <Text style={s.planPrice}>{plan.price} ₽</Text>
            <Text style={s.planPeriod}>в месяц</Text>
          </View>

          <Text style={s.methodsTitle}>Оплата через СБП</Text>

          <TouchableOpacity onPress={handleCreatePayment} disabled={loading} style={s.methodCard}>
            <Text style={s.methodIcon}>💳</Text>
            <View style={s.methodInfo}>
              <Text style={s.methodName}>СБП через Сбербанк</Text>
              <Text style={s.methodDesc}>Оплата через приложение Сбербанк Онлайн</Text>
            </View>
            {loading ? <ActivityIndicator color="#3b82f6" /> : <Text style={s.methodArrow}>›</Text>}
          </TouchableOpacity>

          <Text style={s.hint}>Система Быстрых Платежей (СБП). Мгновенное зачисление. Без комиссии.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={handleCancel} style={s.back}><Text style={s.backText}>← Назад</Text></TouchableOpacity>

        <View style={s.planInfo}>
          <Text style={s.planName}>{plan.name}</Text>
          <Text style={s.planPrice}>{plan.price} ₽</Text>
        </View>

        <View style={s.paymentCard}>
          <Text style={s.paymentTitle}>Оплата через СБП</Text>

          {/* QR Code */}
          {paymentData.sbpPayload && QRCode ? (
            <View style={s.qrSection}>
              <QRCode
                value={paymentData.sbpPayload}
                size={QR_SIZE}
                backgroundColor="white"
                color="#18181b"
              />
              <Text style={s.qrHint}>Отсканируйте QR-код в приложении банка</Text>
            </View>
          ) : (
            <View style={s.qrPlaceholder}>
              <Text style={s.qrPlaceholderIcon}>📱</Text>
              <Text style={s.qrPlaceholderText}>QR-код для оплаты</Text>
              <Text style={s.qrPlaceholderHint}>Установите react-native-qrcode-svg для отображения QR</Text>
            </View>
          )}

          {/* Payment details */}
          <View style={s.detailsBox}>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Получатель</Text>
              <Text style={s.detailValue}>+{paymentData.recipientPhone}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Банк</Text>
              <Text style={s.detailValue}>{paymentData.recipientBank}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Сумма</Text>
              <Text style={s.detailValueBold}>{plan.price} ₽</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Назначение</Text>
              <Text style={s.detailValue}>{paymentData.purpose}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handlePaySberbank} style={s.payBtn}>
            <Text style={s.payBtnText}>Открыть в Сбербанк Онлайн</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePayManual} style={s.manualBtn}>
            <Text style={s.manualBtnText}>Я оплатил по номеру телефона</Text>
          </TouchableOpacity>

          <Text style={s.waitingHint}>Ожидание оплаты... Статус проверяется автоматически</Text>
          <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 8 }} />
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
  planInfo: { backgroundColor: '#f0fdf4', borderRadius: 16, borderWidth: 1, borderColor: '#a7f3d0', padding: 20, alignItems: 'center', marginBottom: 24 },
  planName: { fontSize: 16, fontWeight: '600', color: '#059669' },
  planPrice: { fontSize: 36, fontWeight: '700', color: '#059669', marginTop: 8 },
  planPeriod: { fontSize: 13, color: '#059669', marginTop: 4 },
  methodsTitle: { fontSize: 13, fontWeight: '600', color: '#18181b', marginBottom: 12 },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', padding: 16, marginBottom: 8 },
  methodIcon: { fontSize: 24, marginRight: 12 },
  methodInfo: { flex: 1 },
  methodName: { fontSize: 14, fontWeight: '600', color: '#18181b' },
  methodDesc: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  methodArrow: { fontSize: 20, color: '#a1a1aa' },
  hint: { fontSize: 11, color: '#a1a1aa', textAlign: 'center', marginTop: 24 },
  paymentCard: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', padding: 20 },
  paymentTitle: { fontSize: 15, fontWeight: '600', color: '#18181b', marginBottom: 16, textAlign: 'center' },
  qrSection: { alignItems: 'center', padding: 16, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', marginBottom: 16 },
  qrHint: { fontSize: 11, color: '#71717a', marginTop: 8, textAlign: 'center' },
  qrPlaceholder: { alignItems: 'center', padding: 24, backgroundColor: '#fafafa', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', borderStyle: 'dashed', marginBottom: 16 },
  qrPlaceholderIcon: { fontSize: 40, marginBottom: 8 },
  qrPlaceholderText: { fontSize: 13, color: '#52525b', fontWeight: '500' },
  qrPlaceholderHint: { fontSize: 10, color: '#a1a1aa', marginTop: 4, textAlign: 'center' },
  detailsBox: { backgroundColor: '#fafafa', borderRadius: 12, padding: 14, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  detailLabel: { fontSize: 13, color: '#71717a' },
  detailValue: { fontSize: 13, color: '#18181b', fontWeight: '500' },
  detailValueBold: { fontSize: 15, color: '#059669', fontWeight: '700' },
  payBtn: { backgroundColor: '#15803d', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  payBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  manualBtn: { paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12 },
  manualBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '500' },
  waitingHint: { fontSize: 11, color: '#a1a1aa', textAlign: 'center', marginTop: 16 },
});
