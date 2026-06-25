import { api } from './api';

const SBP_MERCHANT = process.env.EXPO_PUBLIC_SBP_MERCHANT || '';
const SBP_MERCHANT_NAME = process.env.EXPO_PUBLIC_SBP_MERCHANT_NAME || 'AI Техкарты';

interface CreatePaymentResult {
  paymentId: string;
  amount: number;
  tariff: string;
  paymentUrl: string;
  sbpPayload: string;
  sbpQr: string | null;
  qrData: string;
  recipientPhone: string;
  recipientBank: string;
  purpose: string;
}

export async function createPayment(tariff: string): Promise<CreatePaymentResult> {
  return api.post('/api/mobile/payments/create', { tariff });
}

export async function checkPaymentStatus(paymentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  tariff: string;
  paidAt: string | null;
}> {
  return api.get(`/api/mobile/payments/${paymentId}/status`);
}

export async function confirmPayment(paymentId: string): Promise<void> {
  await api.post('/api/mobile/payments/webhook', { paymentId, status: 'success' });
}

// Generate SBP QR-code payload string (used on backend too)
export function generateSbpPayload(amount: number, purpose: string): string {
  // Format: https://qr.nspk.ru/PAYLOAD?amount=...&purpose=...&redirect=false
  const params = new URLSearchParams({
    amount: String(amount),
    purpose: purpose.slice(0, 160),
    redirect: 'false',
  });
  return `https://qr.nspk.ru/PAYLOAD?${params.toString()}`;
}

// Generate Sberbank payment URL
export function generateSberbankUrl(phone: string, amount: number, bic?: string): string {
  const params = new URLSearchParams({
    requisiteNumber: phone.replace(/[^\d]/g, ''),
    bankCode: bic || '100000000111',
    amount: String(amount),
  });
  return `https://www.sberbank.ru/ru/choise_bank?${params.toString()}`;
}
