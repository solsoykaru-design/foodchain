import crypto from 'crypto';
import { config } from '../config.js';

const PAYME_API = 'https://checkout.payme.uz/api';

function isConfigured() {
  return !!(config.payme.merchantId && config.payme.secretKey
    && config.payme.merchantId !== 'dev-payme-merchant'
    && config.payme.secretKey !== 'dev-payme-secret');
}

function getAuthHeaders() {
  const credentials = Buffer.from(`${config.payme.merchantId}:${config.payme.secretKey}`).toString('base64');
  return { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` };
}

async function paymeRequest(method, params) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  });
  const res = await fetch(PAYME_API, { method: 'POST', headers: getAuthHeaders(), body });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Payme API error');
  return data.result;
}

export { isConfigured };

export async function createSubscription({ cardNumber, expireDate, amount, tenantId, tariffName, tariffId }) {
  if (!isConfigured()) throw new Error('Payme не настроен');
  const result = await paymeRequest('Recurring.Create', {
    merchantId: config.payme.merchantId,
    amount: Math.round(amount * 100),
    currency: 860,
    description: `Подписка "${tariffName}" (ID #${tariffId})`,
    account: { tenant_id: String(tenantId), tariff_id: String(tariffId) },
    card: { number: cardNumber, expire: expireDate },
    saveCard: false,
    receiver: config.payme.merchantId,
  });
  return {
    subscriptionId: result.id,
    redirectUrl: `https://checkout.payme.uz/subscription/${result.id}`,
    state: result.state,
  };
}

export async function getSubscription(subscriptionId) {
  const result = await paymeRequest('Recurring.Get', { id: subscriptionId });
  return result;
}

export async function cancelSubscription(subscriptionId) {
  const result = await paymeRequest('Recurring.Cancel', { id: subscriptionId });
  return result;
}

export async function createInitialPayment(amount, tenantId, tariffId, tariffName, tenantPhone) {
  if (!isConfigured()) throw new Error('Payme не настроен');
  const orderKey = `sub_${tenantId}_${Date.now()}`;
  const result = await paymeRequest('Receipts.Create', {
    amount: Math.round(amount * 100),
    currency: 860,
    description: `Подписка "${tariffName}" (арендатор #${tenantId})`,
    account: { tenant_id: String(tenantId), tariff_id: String(tariffId) },
    order_key: orderKey,
  });
  return {
    receiptId: result.receipt_id,
    redirectUrl: `https://checkout.payme.uz/receipt/${result.receipt_id}`,
  };
}

export async function checkPayment(receiptId) {
  const result = await paymeRequest('Receipts.Check', { id: receiptId });
  return result;
}

export function verifyWebhookSignature(body, signature, timestamp) {
  if (!config.payme.secretKey || !signature) return false;
  const payload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', config.payme.secretKey)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
