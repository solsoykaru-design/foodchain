import crypto from 'crypto';

let publicId = null;
let apiSecret = null;
const API_URL = 'https://api.cloudpayments.ru';

export function configureCloudPayments(config) {
  publicId = config.publicId || null;
  apiSecret = config.apiSecret || null;
}

export function isConfigured() {
  return !!(publicId && apiSecret);
}

function getAuth() {
  return Buffer.from(`${publicId}:${apiSecret}`).toString('base64');
}

async function cpRequest(method, params) {
  const res = await fetch(`${API_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${getAuth()}`,
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.Success) throw new Error(data.Message || data.Error || 'CloudPayments error');
  return data.Model;
}

export async function createSubscription({ amount, description, tenantId, tariffId, tariffName, email, returnUrl }) {
  const subscriptionId = `sub_${tenantId}_${Date.now()}`;
  const result = await cpRequest('subscriptions/create', {
    Token: '',
    AccountId: String(tenantId),
    Description: description || `Подписка "${tariffName}"`,
    Email: email || '',
    Amount: amount.toFixed(2),
    Currency: 'RUB',
    RequireConfirmation: true,
    StartDate: new Date().toISOString(),
    IntervalCode: 'Month',
    IntervalValue: 1,
    Period: 0,
    MaxPeriods: 0,
    CustomerReceipt: {
      Items: [{
        label: `Подписка "${tariffName}"`,
        quantity: 1,
        amount: amount.toFixed(2),
        vat: 0,
        method: 4,
        object: 13,
      }],
    },
    JsonData: JSON.stringify({ tenant_id: tenantId, tariff_id: tariffId }),
  });
  return {
    subscriptionId: result.Id,
    status: result.Status,
    paymentUrl: result.Url || null,
    token: result.Token,
  };
}

export async function getSubscription(subscriptionId) {
  return cpRequest('subscriptions/get', { Id: subscriptionId });
}

export async function cancelSubscription(subscriptionId) {
  return cpRequest('subscriptions/cancel', { Id: subscriptionId });
}

export async function updateSubscription({ subscriptionId, amount, nextTransactionDate }) {
  const params = { Id: subscriptionId, Amount: amount?.toFixed(2) };
  if (nextTransactionDate) params.NextTransactionDate = nextTransactionDate;
  return cpRequest('subscriptions/update', params);
}

export function verifyWebhook(body, signature) {
  if (!apiSecret) return false;
  const expected = crypto.createHmac('sha256', apiSecret).update(JSON.stringify(body)).digest('base64');
  if (!signature) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch { return false; }
}
