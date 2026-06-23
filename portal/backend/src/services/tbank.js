import crypto from 'crypto';

let terminalKey = null;
let password = null;
let secretKey = null;
const API_URL = 'https://securepay.tbank.ru/v2';

export function configureTBank(config) {
  terminalKey = config.terminalKey || null;
  password = config.password || null;
  secretKey = config.secretKey || null;
}

export function isConfigured() {
  return !!(terminalKey && (password || secretKey));
}

function genToken(params) {
  const values = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => String(v))
    .concat([password || ''])
    .join('');
  return crypto.createHash('sha256').update(values).digest('hex');
}

async function tbRequest(method, params) {
  const body = { TerminalKey: terminalKey, ...params, Token: '' };
  body.Token = genToken(body);
  const res = await fetch(`${API_URL}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.Success) throw new Error(data.Message || data.ErrorCode || 'T-Bank error');
  return data;
}

export async function createPayment({ amount, description, tenantId, tariffId, tariffName, returnUrl, email }) {
  const orderId = `order_${tenantId}_${Date.now()}`;
  const result = await tbRequest('Init', {
    Amount: Math.round(amount * 100),
    Currency: '643',
    Description: description || `Подписка "${tariffName}"`,
    OrderId: orderId,
    CustomerKey: String(tenantId),
    DATA: {
      Email: email || '',
      ConnectionType: 'COF',
      tenant_id: String(tenantId),
      tariff_id: String(tariffId),
    },
    Receipt: {
      Email: email || 'tenant@foodchain.ru',
      Phone: '',
      Taxation: 'usn_income',
      Items: [{
        Name: `Подписка "${tariffName}"`,
        Price: Math.round(amount * 100),
        Quantity: 1,
        Amount: Math.round(amount * 100),
        Tax: 'none',
      }],
    },
  });
  return {
    paymentId: result.PaymentId,
    orderId: result.OrderId,
    confirmationUrl: result.PaymentURL || null,
    status: result.Status,
  };
}

export async function createSubscription({ amount, description, tenantId, tariffId, tariffName, returnUrl, email }) {
  const orderId = `sub_${tenantId}_${Date.now()}`;
  const result = await tbRequest('Init', {
    Amount: Math.round(amount * 100),
    Currency: '643',
    Description: description || `Подписка "${tariffName}"`,
    OrderId: orderId,
    CustomerKey: String(tenantId),
    Recurring: 'Y',
    DATA: {
      Email: email || '',
      tenant_id: String(tenantId),
      tariff_id: String(tariffId),
    },
    Receipt: {
      Email: email || 'tenant@foodchain.ru',
      Phone: '',
      Taxation: 'usn_income',
      Items: [{
        Name: `Подписка "${tariffName}" (месяц)`,
        Price: Math.round(amount * 100),
        Quantity: 1,
        Amount: Math.round(amount * 100),
        Tax: 'none',
      }],
    },
  });
  return {
    paymentId: result.PaymentId,
    orderId: result.OrderId,
    confirmationUrl: result.PaymentURL || null,
    status: result.Status,
    rebillId: result.RebillId || null,
  };
}

export async function getPayment(paymentId) {
  return tbRequest('GetState', { PaymentId: paymentId });
}

export async function cancelSubscription(rebillId) {
  return tbRequest('CloseCharge', { RebillId: rebillId });
}

export async function chargeRecurring({ rebillId, amount, description, tenantId, orderId }) {
  const result = await tbRequest('Charge', {
    PaymentId: rebillId,
    Amount: Math.round(amount * 100),
    OrderId: orderId || `charge_${tenantId}_${Date.now()}`,
    Description: description || 'Автопродление подписки',
  });
  return result;
}

export function verifyWebhook(body, terminalKeyFromHook) {
  if (!secretKey) return false;
  const token = body.Token;
  if (!token) return false;
  const values = Object.entries(body)
    .filter(([k, v]) => k !== 'Token' && v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => String(v))
    .concat([secretKey])
    .join('');
  const expected = crypto.createHash('sha256').update(values).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch { return false; }
}
