const crypto = require('crypto');

const PROVIDER = 'cloudpayments';

function getAuth(credentials) {
  const publicId = credentials.public_id || '';
  const apiSecret = credentials.api_secret || '';
  const token = Buffer.from(`${publicId}:${apiSecret}`).toString('base64');
  return { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };
}

async function apiRequest(method, path, body, credentials) {
  const baseUrl = credentials.test_mode
    ? 'https://api.cloudpayments.ru'
    : 'https://api.cloudpayments.ru';
  const headers = getAuth(credentials);
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function paymentMethodData(method) {
  switch (method) {
    case 'sbp': return { Type: 'SBP' };
    case 'apple_pay': return { Type: 'ApplePay' };
    case 'google_pay': return { Type: 'GooglePay' };
    default: return {};
  }
}

async function createPayment(params) {
  const { amount, description, returnUrl, metadata, paymentMethod } = params;
  const body = {
    Amount: amount,
    Currency: 'RUB',
    Description: description || '',
    InvoiceId: metadata?.orderId || metadata?.subscriptionId || '',
    AccountId: metadata?.userId || '',
    Email: metadata?.email || '',
    JsonData: metadata || {},
    SuccessUrl: returnUrl || '',
    FailUrl: returnUrl ? returnUrl.replace(/\/?$/, '/fail') : '',
    ...paymentMethodData(paymentMethod || 'card'),
  };
  return apiRequest('POST', '/payments/cards/charge', body, params.credentials);
}

async function confirmPayment(paymentId, credentials) {
  return apiRequest('POST', `/payments/get`, { TransactionId: paymentId }, credentials);
}

async function getPaymentStatus(paymentId, credentials) {
  return apiRequest('POST', '/payments/get', { TransactionId: paymentId }, credentials);
}

async function refundPayment(paymentId, amount, credentials) {
  const body = {
    TransactionId: paymentId,
    Amount: amount,
  };
  return apiRequest('POST', '/payments/refund', body, credentials);
}

async function testConnection(credentials) {
  return apiRequest('POST', '/test', {}, credentials);
}

function verifyWebhookSignature(req, credentials) {
  try {
    const body = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const calculated = crypto.createHmac('sha256', credentials.api_secret || '').update(body).digest('base64');
    const provided = req.headers['content-hmac'] || req.headers['x-content-hmac'] || '';
    return calculated === provided;
  } catch { return false; }
}

function normalizeWebhookEvent(req) {
  const event = req.body;
  if (!event) return null;
  const data = event.Data || event;
  const statusMap = {
    'Authorized': 'pending',
    'Completed': 'succeeded',
    'Cancelled': 'canceled',
    'Refund': 'refunded',
  };
  return {
    event: event.EventType || event.Event || '',
    paymentId: String(data.TransactionId || data.Id || ''),
    status: statusMap[event.EventType || event.Event] || 'pending',
    amount: data.Amount ? parseFloat(data.Amount) : null,
    metadata: data.JsonData || data || {},
    provider: PROVIDER,
    raw: event,
  };
}

module.exports = {
  PROVIDER, createPayment, confirmPayment, getPaymentStatus,
  refundPayment, testConnection, verifyWebhookSignature, normalizeWebhookEvent,
};
