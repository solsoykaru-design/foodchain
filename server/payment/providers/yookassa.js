const crypto = require('crypto');

const PROVIDER = 'yookassa';

function getAuth(credentials) {
  const shopId = credentials.shop_id || '';
  const secretKey = credentials.api_key || '';
  const token = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  return { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json', 'Idempotence-Key': crypto.randomUUID() };
}

async function apiRequest(method, path, body, credentials) {
  const baseUrl = credentials.test_mode ? 'https://api.yookassa.ru/v3' : 'https://api.yookassa.ru/v3';
  const headers = getAuth(credentials);
  headers['Idempotence-Key'] = crypto.randomUUID();
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function paymentMethodData(method) {
  switch (method) {
    case 'sbp': return { type: 'sbp' };
    case 'apple_pay': return { type: 'applepay' };
    case 'google_pay': return { type: 'googlepay' };
    default: return { type: 'bank_card' };
  }
}

async function createPayment(params) {
  const { amount, description, returnUrl, metadata, paymentMethod } = params;
  const body = {
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    description: description || '',
    confirmation: { type: 'redirect', return_url: returnUrl || 'https://example.com' },
    capture: true,
    metadata: metadata || {},
    payment_method_data: paymentMethodData(paymentMethod || 'card'),
  };
  return apiRequest('POST', '/payments', body, params.credentials);
}

async function confirmPayment(paymentId, credentials) {
  return apiRequest('POST', `/payments/${paymentId}/capture`, {}, credentials);
}

async function getPaymentStatus(paymentId, credentials) {
  return apiRequest('GET', `/payments/${paymentId}`, null, credentials);
}

async function refundPayment(paymentId, amount, credentials) {
  const body = {
    payment_id: paymentId,
    amount: { value: amount.toFixed(2), currency: 'RUB' },
  };
  return apiRequest('POST', '/refunds', body, credentials);
}

async function testConnection(credentials) {
  return apiRequest('GET', '/payments?limit=1', null, credentials);
}

function verifyWebhookSignature(req, credentials) {
  try {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Basic ')) return false;
    const encoded = authHeader.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');
    return user === credentials.shop_id && pass === credentials.api_key;
  } catch { return false; }
}

function normalizeWebhookEvent(req) {
  const event = req.body;
  if (!event) return null;
  const payment = event.object || event;
  const statusMap = {
    'waiting_for_capture': 'pending',
    'succeeded': 'succeeded',
    'canceled': 'canceled',
    'refunded': 'refunded',
  };
  return {
    event: event.event || '',
    paymentId: payment.id || '',
    status: statusMap[payment.status] || payment.status,
    amount: payment.amount?.value ? parseFloat(payment.amount.value) : null,
    metadata: payment.metadata || {},
    provider: PROVIDER,
    raw: event,
  };
}

module.exports = {
  PROVIDER, createPayment, confirmPayment, getPaymentStatus,
  refundPayment, testConnection, verifyWebhookSignature, normalizeWebhookEvent,
};
