const crypto = require('crypto');

const PROVIDER = 'sberbank';

// SberPay currently uses T-Bank for QR payments.
// This provider stores client_id/client_secret for Sberbank API access.
// Webhook notifications from Sberpay QR come through T-Bank (tbank.js handles them).

async function createPayment(params) {
  return { ok: false, status: 400, data: { message: 'Прямая интеграция со Сбербанком не реализована. Для SberPay QR используйте Т-Банк.' } };
}

async function confirmPayment() {
  return { ok: false, status: 400, data: { message: 'Прямая интеграция со Сбербанком не реализована.' } };
}

async function getPaymentStatus() {
  return { ok: false, status: 400, data: { message: 'Прямая интеграция со Сбербанком не реализована.' } };
}

async function refundPayment() {
  return { ok: false, status: 400, data: { message: 'Прямая интеграция со Сбербанком не реализована.' } };
}

async function testConnection(credentials) {
  const hasFields = credentials.client_id?.trim() && credentials.client_secret?.trim();
  return {
    ok: hasFields,
    status: hasFields ? 200 : 400,
    data: hasFields ? { message: 'Ключи Сбербанка сохранены. Для SberPay QR используется Т-Банк.' } : { message: 'Заполните client_id и client_secret' },
  };
}

function verifyWebhookSignature(req, credentials) {
  try {
    const body = req.body || {};
    const secret = credentials.client_secret || '';
    const receivedChecksum = body.checksum || '';

    // Method 1: Sberbank checksum (when called directly)
    if (receivedChecksum && secret) {
      const keys = Object.keys(body)
        .filter(k => k !== 'checksum')
        .sort();
      const signStr = keys.map(k => `${k}=${body[k]}`).join('');
      const expected = crypto.createHmac('sha256', secret).update(signStr).digest('hex').toUpperCase();
      if (expected === receivedChecksum.toUpperCase()) return true;
    }

    // Method 2: X-Signature header (HMAC-SHA256 of raw body)
    const headerSig = req.headers['x-signature'] || '';
    if (headerSig && secret) {
      const rawBody = req.rawBody?.toString() || JSON.stringify(body);
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex').toLowerCase();
      if (expected === headerSig.toLowerCase()) return true;
    }

    // Method 3: If the notification comes from T-Bank (SberPay QR goes through T-Bank),
    // the verifyWebhookSignature in tbank.js handles it.
    // Here we return false to let the caller try other methods.
    return false;
  } catch {
    return false;
  }
}

function normalizeWebhookEvent(req) {
  const event = req.body;
  if (!event) return null;

  // Sberbank direct notification format
  if (event.merchantOrderNumber || event.orderNumber) {
    const statusMap = {
      '0': 'succeeded',
      '1': 'failed',
      '2': 'canceled',
      '3': 'refunded',
      success: 'succeeded',
      failure: 'failed',
      cancel: 'canceled',
    };
    return {
      event: event.action || event.status || '',
      paymentId: String(event.paymentId || event.orderNumber || ''),
      status: statusMap[String(event.status)] || event.status || 'pending',
      amount: event.amount ? Number(event.amount) : null,
      metadata: event,
      provider: PROVIDER,
      raw: event,
    };
  }

  // If it's a T-Bank notification forwarded here, return null
  // (tbank.js handles it via auto-detection)
  if (event.TerminalKey || event.PaymentId) return null;

  return null;
}

module.exports = {
  PROVIDER, createPayment, confirmPayment, getPaymentStatus,
  refundPayment, testConnection, verifyWebhookSignature, normalizeWebhookEvent,
};
