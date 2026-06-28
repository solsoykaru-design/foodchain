import crypto from 'crypto';

let shopId = null;
let secretKey = null;

export function configureYooKassa(config) {
  shopId = config.shopId || null;
  secretKey = config.secretKey || null;
}

export function isConfigured() {
  return !!(shopId && secretKey);
}

function getAuth() {
  return Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

export async function createPayment({ amount, description, tenantId, tariffId, tariffName, returnUrl }) {
  if (!isConfigured()) throw new Error('ЮKassa не настроен');
  const idempotenceKey = crypto.randomUUID();
  const body = {
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    capture: true,
    description: description || `Подписка "${tariffName}"`,
    metadata: { tenant_id: String(tenantId), tariff_id: String(tariffId) },
    confirmation: {
      type: 'redirect',
      return_url: returnUrl || 'http://localhost:4000/portal/subscription',
    },
    receipt: {
      items: [{
        description: `Подписка "${tariffName}"`,
        quantity: '1.00',
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        vat_code: 1,
      }],
    },
  };
  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${getAuth()}`,
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.description || data.error.code || 'YooKassa error');
  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url || null,
    status: data.status,
  };
}

export async function createSubscription({ amount, description, tenantId, tariffId, tariffName, returnUrl }) {
  const idempotenceKey = crypto.randomUUID();
  const body = {
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    capture: true,
    description: description || `Подписка "${tariffName}"`,
    metadata: { tenant_id: String(tenantId), tariff_id: String(tariffId), recurring: 'true' },
    confirmation: {
      type: 'redirect',
      return_url: returnUrl || 'http://localhost:4000/portal/subscription',
    },
    payment_method_data: { type: 'bank_card' },
    save_payment_method: true,
    receipt: {
      items: [{
        description: `Подписка "${tariffName}" (месяц)`,
        quantity: '1.00',
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        vat_code: 1,
      }],
    },
  };
  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${getAuth()}`,
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.description || data.error.code || 'YooKassa error');
  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url || null,
    status: data.status,
    paymentMethodId: data.payment_method?.id || null,
  };
}

export async function getPayment(paymentId) {
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { 'Authorization': `Basic ${getAuth()}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.description || 'YooKassa error');
  return data;
}

export async function createRepeatPayment({ paymentMethodId, amount, description, tenantId, tariffId }) {
  const idempotenceKey = crypto.randomUUID();
  const body = {
    amount: { value: amount.toFixed(2), currency: 'RUB' },
    capture: true,
    description: description || 'Автопродление подписки',
    metadata: { tenant_id: String(tenantId), tariff_id: String(tariffId), recurring: 'true' },
    payment_method_id: paymentMethodId,
  };
  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${getAuth()}`,
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.description || 'YooKassa error');
  return data;
}

export function verifyWebhook(body, signature) {
  if (!secretKey) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex');
  if (!signature) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch { return false; }
}
