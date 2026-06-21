const crypto = require('crypto');
const TbankPayments = require('tbank-payments');

const PROVIDER = 'tbank';
const TEST_ORDER_PREFIX = '__test__';

function createClient(credentials) {
  return new TbankPayments({
    merchantId: credentials.terminal_key || '',
    secret: credentials.api_key || '',
    apiUrl: credentials.test_mode
      ? 'https://rest-api-test.tbank.ru'
      : 'https://securepay.tbank.ru',
    retryConfig: { retries: 1 },
  });
}

async function createPayment(params) {
  const { amount, description, returnUrl, metadata, paymentMethod } = params;
  const client = createClient(params.credentials);

  const orderId = String(metadata?.orderId || metadata?.subscriptionId || Date.now());
  const paymentWay = paymentMethod === 'sbp' ? 'SBP' : undefined;

  try {
    const result = await client.initPayment({
      Amount: TbankPayments.amountToKopecks(amount),
      OrderId: orderId,
      Description: description || '',
      SuccessURL: returnUrl || '',
      FailURL: returnUrl ? returnUrl.replace(/\/?$/, '/fail') : '',
      NotificationURL: params.credentials.webhookUrl || metadata?.webhookUrl || '',
      DATA: { ...(metadata || {}), orderId },
      PayType: paymentWay,
    });

    return {
      ok: true,
      status: 200,
      data: {
        id: result.PaymentId,
        confirmation_url: result.PaymentURL,
        confirmation: { confirmation_url: result.PaymentURL },
        ...result,
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: e.response?.status || 500,
      data: {
        message: e.message,
        error_description: e.response?.data?.Message || e.response?.data?.Details || '',
        ...(e.response?.data || {}),
      },
    };
  }
}

async function confirmPayment(paymentId, credentials) {
  const client = createClient(credentials);
  try {
    const result = await client.confirmPayment({ PaymentId: paymentId });
    return { ok: true, status: 200, data: result };
  } catch (e) {
    return { ok: false, status: e.response?.status || 500, data: { message: e.message } };
  }
}

async function getPaymentStatus(paymentId, credentials) {
  const client = createClient(credentials);
  try {
    const result = await client.getPaymentState({ PaymentId: paymentId });
    return { ok: true, status: 200, data: result };
  } catch (e) {
    return { ok: false, status: e.response?.status || 500, data: { message: e.message } };
  }
}

async function refundPayment(paymentId, amount, credentials) {
  const client = createClient(credentials);
  try {
    const result = await client.cancelPayment({
      PaymentId: paymentId,
      ...(amount ? { Amount: TbankPayments.amountToKopecks(amount) } : {}),
    });
    return { ok: true, status: 200, data: result };
  } catch (e) {
    return { ok: false, status: e.response?.status || 500, data: { message: e.message } };
  }
}

async function testConnection(credentials) {
  const client = createClient(credentials);
  try {
    const testOrderId = TEST_ORDER_PREFIX + Date.now().toString(36);
    const result = await client.initPayment({
      Amount: 1,
      OrderId: testOrderId,
      Description: 'Тестовый платёж — будет сразу отменён',
      SuccessURL: 'https://example.com/success',
      FailURL: 'https://example.com/fail',
    });

    await client.cancelPayment({ PaymentId: result.PaymentId }).catch(() => {});

    return { ok: true, status: 200, data: { ...result, testPassed: true, testOrderId } };
  } catch (e) {
    return {
      ok: false,
      status: e.response?.status || 500,
      data: {
        message: e.message,
        error_description: e.response?.data?.Message || e.response?.data?.Details || 'Ошибка подключения к Т-Банку. Проверьте Terminal Key и Secret Key.',
      },
    };
  }
}

function verifyWebhookSignature(req, credentials) {
  try {
    const notification = req.body || {};
    const secret = credentials.api_key || '';

    // ── Method 1: X-Signature header (HMAC-SHA256 of raw body) ──
    const headerSignature = req.headers['x-signature'] || '';
    if (headerSignature) {
      const rawBody = req.rawBody?.toString() || JSON.stringify(notification);
      const expectedFromBody = crypto.createHmac('sha256', secret).update(rawBody).digest('hex').toLowerCase();
      if (expectedFromBody === headerSignature.toLowerCase()) return true;
    }

    // ── Method 2: Token field in body (T-Bank standard) ──
    const receivedToken = notification.Token || '';
    if (receivedToken) {
      const keys = Object.keys(notification)
        .filter(k => k !== 'Token')
        .sort();
      const values = keys.map(k => String(notification[k]));
      values.push(secret);
      const concatenated = values.join('');
      const expectedToken = crypto.createHash('sha256').update(concatenated).digest('hex').toLowerCase();
      if (expectedToken === receivedToken.toLowerCase()) return true;
    }

    // ── Method 3: Fallback to tbank-payments library ──
    if (receivedToken) {
      try {
        const client = createClient(credentials);
        return client.verifyNotificationSignature(notification, receivedToken);
      } catch {}
    }

    return false;
  } catch {
    return false;
  }
}

function normalizeWebhookEvent(req) {
  const event = req.body;
  if (!event) return null;
  const statusMap = {
    CONFIRMED: 'succeeded',
    AUTHORIZED: 'pending',
    CANCELED: 'failed',
    REVERSED: 'refunded',
    REFUNDED: 'refunded',
  };
  return {
    event: event.Status || event.Event || '',
    paymentId: String(event.PaymentId || ''),
    status: statusMap[event.Status] || event.Status || 'pending',
    amount: event.Amount ? Number(event.Amount) / 100 : null,
    metadata: event.DATA || {},
    provider: PROVIDER,
    raw: event,
  };
}

async function createSbpQr(params) {
  const { amount, description, orderId, metadata, returnUrl } = params;
  const client = createClient(params.credentials);

  try {
    const payment = await client.initPayment({
      Amount: TbankPayments.amountToKopecks(amount),
      OrderId: String(orderId || Date.now()),
      Description: description || '',
      NotificationURL: params.credentials.webhookUrl || metadata?.webhookUrl || '',
      DATA: { ...(metadata || {}), orderId },
      PayType: 'SBP',
    });

    const qrResult = await client.getQr({
      PaymentId: payment.PaymentId,
      DataType: 'IMAGE',
    });

    return {
      ok: true,
      status: 200,
      data: {
        paymentId: String(payment.PaymentId),
        qrCode: qrResult.QrImage || qrResult.Data || '',
        qrPayload: qrResult.Payload || '',
        qrExpiry: Date.now() + 5 * 60 * 1000,
        ...payment,
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: e.response?.status || 500,
      data: {
        message: e.message,
        error_description: e.response?.data?.Message || e.response?.data?.Details || '',
      },
    };
  }
}

async function createSberPayQr(params) {
  const { amount, description, orderId, metadata, returnUrl } = params;
  const client = createClient(params.credentials);

  try {
    const payment = await client.initPayment({
      Amount: TbankPayments.amountToKopecks(amount),
      OrderId: String(orderId || Date.now()),
      Description: description || '',
      NotificationURL: params.credentials.webhookUrl || metadata?.webhookUrl || '',
      DATA: { ...(metadata || {}), orderId },
    });

    const qrResult = await client.getSberPayQr({ paymentId: payment.PaymentId });

    return {
      ok: true,
      status: 200,
      data: {
        paymentId: String(payment.PaymentId),
        qrCode: qrResult.QrImage || qrResult.Data || qrResult?.link || '',
        qrExpiry: Date.now() + 5 * 60 * 1000,
        ...payment,
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: e.response?.status || 500,
      data: {
        message: e.message,
        error_description: e.response?.data?.Message || e.response?.data?.Details || '',
      },
    };
  }
}

async function getQrStatus(paymentId, credentials) {
  const client = createClient(credentials);
  try {
    const result = await client.getQrState({ PaymentId: paymentId });
    return { ok: true, status: 200, data: result };
  } catch (e) {
    return { ok: false, status: e.response?.status || 500, data: { message: e.message } };
  }
}

module.exports = {
  PROVIDER, createPayment, confirmPayment, getPaymentStatus,
  refundPayment, testConnection, verifyWebhookSignature, normalizeWebhookEvent,
  createSbpQr, createSberPayQr, getQrStatus,
};
