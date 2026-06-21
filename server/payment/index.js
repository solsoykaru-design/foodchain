const crypto = require('crypto');
const path = require('path');
const cryptoUtils = require(path.join(__dirname, '..', 'crypto-utils'));

const PROVIDERS = {
  yookassa: require('./providers/yookassa'),
  cloudpayments: require('./providers/cloudpayments'),
  tbank: require('./providers/tbank'),
  sberbank: require('./providers/sberbank'),
};

const PROVIDER_NAMES = {
  yookassa: 'ЮKassa',
  cloudpayments: 'CloudPayments',
  tbank: 'Т-Банк (Т-Касса)',
  sberbank: 'Сбербанк (SberPay)',
};

const PAYMENT_METHOD_LABELS = {
  card: 'Банковская карта',
  sbp: 'СБП',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

function uuid() {
  return 'pay_' + Date.now().toString(36) + '_' + crypto.randomBytes(8).toString('hex');
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER DEFAULT 1,
      order_id INTEGER,
      subscription_id INTEGER,
      external_payment_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RUB',
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'card',
      provider TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      description TEXT,
      return_url TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_payment_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      tariff_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      auto_renew INTEGER DEFAULT 1,
      payment_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tariffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      period TEXT DEFAULT 'month',
      description TEXT,
      features TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 0,
      credentials TEXT DEFAULT '{}',
      test_mode INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      provider TEXT NOT NULL,
      payment_id TEXT,
      payload TEXT NOT NULL,
      signature TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'processed',
      error_message TEXT,
      processed_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON webhook_logs(processed_at)`);

  for (const key of Object.keys(PROVIDERS)) {
    const existing = db.prepare('SELECT id FROM payment_settings WHERE provider = ?').get(key);
    if (!existing) {
      db.prepare(`INSERT INTO payment_settings (provider, enabled, credentials, test_mode) VALUES (?, 0, '{}', 0)`).run(key);
    }
  }

  try { db.exec(`INSERT OR IGNORE INTO tariffs (id, name, price, period, description, features, is_active, sort_order) VALUES (1, 'Базовый', 9990, 'month', 'Базовый тариф для одного ресторана', '["До 100 заказов/день","Базовая аналитика","Поддержка по email","1 пользователь"]', 1, 1)`); } catch(e) {}
  try { db.exec(`INSERT OR IGNORE INTO tariffs (id, name, price, period, description, features, is_active, sort_order) VALUES (2, 'Профессиональный', 24900, 'month', 'Для активно развивающихся ресторанов', '["До 500 заказов/день","Расширенная аналитика","Приоритетная поддержка","До 5 пользователей","Интеграция с агрегаторами"]', 1, 2)`); } catch(e) {}
  try { db.exec(`INSERT OR IGNORE INTO tariffs (id, name, price, period, description, features, is_active, sort_order) VALUES (3, 'Enterprise', 59900, 'month', 'Для сетей ресторанов', '["Безлимит заказов","Полная аналитика","Выделенный менеджер","Неограничено пользователей","Все интеграции","White label"]', 1, 3)`); } catch(e) {}

  try { db.exec(`ALTER TABLE payment_settings ADD COLUMN sbp_enabled INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE payment_settings ADD COLUMN sber_enabled INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE payment_settings ADD COLUMN sber_client_id TEXT DEFAULT ''`); } catch (e) {}
  try { db.exec(`ALTER TABLE payment_settings ADD COLUMN sber_client_secret TEXT DEFAULT ''`); } catch (e) {}
  try { db.exec(`ALTER TABLE payment_settings ADD COLUMN notification_url TEXT DEFAULT ''`); } catch (e) {}

  try { db.exec(`ALTER TABLE orders ADD COLUMN is_paid_online INTEGER DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_id TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN payment_error TEXT DEFAULT ''`); } catch (e) {}
}

function setupRoutes(app, db, broadcast, io) {
  // === Payment Settings ===
  function decryptCredentials(provider, creds) {
    if (provider === 'tbank' && creds.api_key && creds.api_key.startsWith('$enc$')) {
      creds.api_key = cryptoUtils.decrypt(creds.api_key);
    }
    return creds;
  }

  function encryptCredentials(provider, creds) {
    if (provider === 'tbank' && creds.api_key && !creds.api_key.startsWith('$enc$')) {
      creds.api_key = cryptoUtils.encrypt(creds.api_key);
    }
    return creds;
  }

  function getCredentials(db, provider) {
    const row = db.prepare('SELECT * FROM payment_settings WHERE provider = ?').get(provider);
    if (!row) return null;
    const creds = (() => { try { return JSON.parse(row.credentials || '{}'); } catch { return {}; } })();
    creds.test_mode = !!row.test_mode;
    creds.webhookUrl = row.notification_url || '';
    if (provider === 'sberbank') {
      creds.client_id = row.sber_client_id || '';
      creds.client_secret = row.sber_client_secret ? cryptoUtils.decrypt(row.sber_client_secret) : '';
      creds.sbp_enabled = !!row.sbp_enabled;
      creds.sber_enabled = !!row.sber_enabled;
    }
    if (provider === 'tbank') {
      creds.sbp_enabled = !!row.sbp_enabled;
    }
    return decryptCredentials(provider, creds);
  }

  app.get('/api/admin/payment/settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM payment_settings ORDER BY provider').all();
      res.json(rows.map(r => {
        const creds = (() => { try { return JSON.parse(r.credentials); } catch { return {}; } })();
        const decryptedSberSecret = r.sber_client_secret ? cryptoUtils.decrypt(r.sber_client_secret) : '';
        return {
          ...r,
          sber_client_secret: decryptedSberSecret,
          credentials: decryptCredentials(r.provider, creds),
        };
      }));
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.put('/api/admin/payment/settings/:provider', (req, res) => {
    try {
      const provider = req.params.provider;
      if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Неизвестный провайдер' });
      const existing = db.prepare('SELECT id FROM payment_settings WHERE provider = ?').get(provider);
      let creds = req.body.credentials ? { ...req.body.credentials } : undefined;
      if (creds) {
        const existingCreds = existing
          ? (() => { try { return JSON.parse(db.prepare('SELECT credentials FROM payment_settings WHERE id = ?').get(existing.id).credentials); } catch { return {}; } })()
          : {};
        if (provider === 'tbank' && creds.api_key && !creds.api_key.startsWith('$enc$') && creds.api_key === existingCreds.api_key) {
          const existingEncrypted = existingCreds.encrypted_api_key;
          if (existingEncrypted) creds.api_key = existingEncrypted;
        }
        if (provider === 'tbank' && creds.api_key && !creds.api_key.startsWith('$enc$')) {
          creds = encryptCredentials(provider, creds);
        }
      }
      const credentials = creds ? JSON.stringify(creds) : undefined;
      const enabled = req.body.enabled !== undefined ? (req.body.enabled ? 1 : 0) : undefined;
      const testMode = req.body.test_mode !== undefined ? (req.body.test_mode ? 1 : 0) : undefined;
      const sbpEnabled = req.body.sbp_enabled !== undefined ? (req.body.sbp_enabled ? 1 : 0) : undefined;
      const sberEnabled = req.body.sber_enabled !== undefined ? (req.body.sber_enabled ? 1 : 0) : undefined;
      const sberClientId = req.body.sber_client_id !== undefined ? req.body.sber_client_id : undefined;
      const sberClientSecretEncrypted = req.body.sber_client_secret !== undefined
        ? cryptoUtils.encrypt(req.body.sber_client_secret)
        : undefined;
      const notificationUrl = req.body.notification_url !== undefined ? req.body.notification_url : undefined;
      const sets = ["updated_at = datetime('now')"];
      const vals = [];
      if (credentials !== undefined) { sets.push('credentials = ?'); vals.push(credentials); }
      if (enabled !== undefined) { sets.push('enabled = ?'); vals.push(enabled); }
      if (testMode !== undefined) { sets.push('test_mode = ?'); vals.push(testMode); }
      if (sbpEnabled !== undefined) { sets.push('sbp_enabled = ?'); vals.push(sbpEnabled); }
      if (sberEnabled !== undefined) { sets.push('sber_enabled = ?'); vals.push(sberEnabled); }
      if (sberClientId !== undefined) { sets.push('sber_client_id = ?'); vals.push(sberClientId); }
      if (sberClientSecretEncrypted !== undefined) { sets.push('sber_client_secret = ?'); vals.push(sberClientSecretEncrypted); }
      if (notificationUrl !== undefined) { sets.push('notification_url = ?'); vals.push(notificationUrl); }
      if (existing) { vals.push(existing.id); db.prepare(`UPDATE payment_settings SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
      else { db.prepare('INSERT INTO payment_settings (provider, enabled, credentials, test_mode, sbp_enabled, sber_enabled, sber_client_id, sber_client_secret, notification_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(provider, enabled || 0, credentials || '{}', testMode !== undefined ? testMode : 1, sbpEnabled || 0, sberEnabled || 0, sberClientId || '', sberClientSecretEncrypted || '', notificationUrl || ''); }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === Test Connection ===
  app.post('/api/admin/payment/settings/:provider/test', async (req, res) => {
    try {
      const provider = req.params.provider;
      const p = PROVIDERS[provider];
      if (!p) return res.status(400).json({ error: 'Неизвестный провайдер' });

      const credentials = getCredentials(db, provider);
      if (!credentials) return res.status(404).json({ error: 'Провайдер не найден' });

      const result = await p.testConnection(credentials);
      res.json({ ok: result.ok, status: result.status, data: result.data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === Create Payment ===
  app.post('/api/payment/create', async (req, res) => {
    try {
      const { orderId, amount, description, returnUrl, paymentMethod, provider, metadata, subscriptionId } = req.body;
      const p = PROVIDERS[provider || 'yookassa'];
      if (!p) return res.status(400).json({ error: 'Неизвестный провайдер' });

      const credentials = getCredentials(db, provider);
      if (!credentials || !db.prepare('SELECT id FROM payment_settings WHERE provider = ? AND enabled = 1').get(provider)) {
        return res.status(400).json({ error: 'Платёжная система не активна' });
      }

      const paymentId = uuid();
      const meta = { ...(metadata || {}), paymentId, orderId: orderId || null, subscriptionId: subscriptionId || null };
      if (returnUrl) meta.returnUrl = returnUrl;

      const result = await p.createPayment({
        amount: amount || 0,
        description: description || 'Оплата заказа',
        returnUrl: returnUrl || '',
        paymentMethod: paymentMethod || 'card',
        metadata: meta,
        credentials,
      });

      const externalPaymentId = result.data?.id || result.data?.PaymentId || result.data?.TransactionId || '';
      const confirmationUrl = result.data?.confirmation?.confirmation_url ||
        result.data?.confirmation_url || result.data?.PaymentURL || '';

      const status = result.ok ? 'pending' : 'error';
      const errorMsg = result.ok ? null : (result.data?.error_description || result.data?.Message || result.data?.message || JSON.stringify(result.data));

      db.prepare(`INSERT INTO payments (id, tenant_id, order_id, subscription_id, external_payment_id, amount, status, payment_method, provider, metadata, description, return_url, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        paymentId, req.body.tenantId || 1, orderId || null, subscriptionId || null,
        externalPaymentId, amount || 0, status, paymentMethod || 'card', provider,
        JSON.stringify(meta), description || '', returnUrl || '', errorMsg
      );

      if (orderId && status === 'pending') {
        db.prepare("UPDATE orders SET payment_id = ?, is_paid_online = 1 WHERE id = ?").run(paymentId, orderId);
      }

      res.json({
        ok: result.ok,
        paymentId,
        externalPaymentId,
        confirmationUrl,
        status,
        error: errorMsg,
      });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // === QR Payment (SBP / SberPay) ===
  app.post('/api/payment/qr', async (req, res) => {
    try {
      const { orderId, amount, description, returnUrl, qrType, metadata, tenantId } = req.body;
      if (!amount || !qrType) return res.status(400).json({ error: 'amount и qrType обязательны' });

      const provider = qrType === 'sber' ? 'sberbank' : 'tbank';
      const p = PROVIDERS.tbank;
      if (!p || !p.createSbpQr || (qrType !== 'sbp' && qrType !== 'sber')) return res.status(400).json({ error: 'QR-платежи не поддерживаются для этого провайдера' });

      const credentials = getCredentials(db, 'tbank');
      if (!credentials) return res.status(400).json({ error: 'Т-Банк не настроен' });

      const activeCheck = qrType === 'sber'
        ? db.prepare('SELECT sber_enabled FROM payment_settings WHERE provider = ?').get('sberbank')
        : db.prepare('SELECT sbp_enabled FROM payment_settings WHERE provider = ?').get('tbank');
      if (!activeCheck || !(qrType === 'sber' ? activeCheck.sber_enabled : activeCheck.sbp_enabled)) {
        return res.status(400).json({ error: 'QR-платежи не активны. Включите в настройках.' });
      }

      const qrMethod = qrType === 'sber' ? p.createSberPayQr : p.createSbpQr;
      const meta = { ...(metadata || {}), orderId: orderId || null };

      const result = await qrMethod({
        amount: amount || 0,
        description: description || 'Оплата по QR',
        orderId: String(orderId || Date.now()),
        returnUrl: returnUrl || '',
        metadata: meta,
        credentials,
      });

      const paymentId = uuid();
      const externalPaymentId = result.data?.paymentId || '';
      const status = result.ok ? 'pending' : 'error';
      const errorMsg = result.ok ? null : (result.data?.error_description || result.data?.message || JSON.stringify(result.data));

      db.prepare(`INSERT INTO payments (id, tenant_id, order_id, external_payment_id, amount, status, payment_method, provider, metadata, description, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        paymentId, tenantId || 1, orderId || null, externalPaymentId,
        amount || 0, status, qrType === 'sber' ? 'sber_qr' : 'sbp_qr', provider,
        JSON.stringify(meta), description || '', errorMsg
      );

      if (orderId && status === 'pending') {
        db.prepare("UPDATE orders SET payment_id = ?, is_paid_online = 1 WHERE id = ?").run(paymentId, orderId);
      }

      res.json({
        ok: result.ok,
        paymentId,
        externalPaymentId,
        qrCode: result.data?.qrCode || '',
        qrExpiry: result.data?.qrExpiry || (Date.now() + 5 * 60 * 1000),
        error: errorMsg,
      });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // === QR Status ===
  app.get('/api/payment/qr-status/:paymentId', async (req, res) => {
    try {
      const paymentId = req.params.paymentId;
      const row = db.prepare('SELECT * FROM payments WHERE external_payment_id = ? OR id = ?').get(paymentId, paymentId);
      if (!row) return res.status(404).json({ error: 'Платёж не найден' });

      const credentials = getCredentials(db, row.provider);
      if (!credentials || !PROVIDERS.tbank.getQrStatus) return res.json({ status: row.status });

      const result = await PROVIDERS.tbank.getQrStatus(row.external_payment_id, credentials);
      res.json({ ok: result.ok, status: row.status, externalStatus: result.data?.Status || '', data: result.data });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // === Confirm Payment ===
  app.post('/api/payment/confirm', async (req, res) => {
    try {
      const { paymentId, provider } = req.body;
      const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
      if (!row) return res.status(404).json({ error: 'Платёж не найден' });

      const prov = provider || row.provider;
      const p = PROVIDERS[prov];
      if (!p) return res.status(400).json({ error: 'Неизвестный провайдер' });

      const credentials = getCredentials(db, prov);
      if (!credentials) return res.status(404).json({ error: 'Провайдер не найден' });
      const result = await p.confirmPayment(row.external_payment_id, credentials);
      res.json({ ok: result.ok, data: result.data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === Get Payment Status ===
  app.get('/api/payment/status/:id', async (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM payments WHERE id = ? OR external_payment_id = ?').get(req.params.id, req.params.id);
      if (!row) return res.status(404).json({ error: 'Платёж не найден' });
      res.json(row);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === Refund ===
  app.post('/api/payment/refund', async (req, res) => {
    try {
      const { paymentId, amount } = req.body;
      const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
      if (!row) return res.status(404).json({ error: 'Платёж не найден' });

      const p = PROVIDERS[row.provider];
      if (!p) return res.status(400).json({ error: 'Неизвестный провайдер' });

      const credentials = getCredentials(db, row.provider);
      if (!credentials) return res.status(404).json({ error: 'Провайдер не найден' });
      const refundAmount = amount || row.amount;

      const result = await p.refundPayment(row.external_payment_id, refundAmount, credentials);

      if (result.ok) {
        db.prepare("UPDATE payments SET status = 'refunded', updated_at = datetime('now') WHERE id = ?").run(paymentId);
        if (row.order_id) {
          db.prepare("UPDATE orders SET is_paid = 0, is_paid_online = 0 WHERE id = ?").run(row.order_id);
        }
      }

      res.json({ ok: result.ok, data: result.data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === List Payments (admin) ===
  app.get('/api/admin/payments', (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      const provider = req.query.provider;
      const type = req.query.type;
      const dateFrom = req.query.date_from;
      const dateTo = req.query.date_to;

      let sql = 'SELECT p.*, o.user_name as order_user_name, o.total as order_total FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE 1=1';
      const params = [];

      if (status) { sql += ' AND p.status = ?'; params.push(status); }
      if (provider) { sql += ' AND p.provider = ?'; params.push(provider); }
      if (type === 'order') { sql += ' AND p.order_id IS NOT NULL'; }
      if (type === 'subscription') { sql += ' AND p.subscription_id IS NOT NULL'; }
      if (dateFrom) { sql += " AND p.created_at >= ?"; params.push(dateFrom); }
      if (dateTo) { sql += " AND p.created_at <= ?"; params.push(dateTo + ' 23:59:59'); }

      const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
      const items = db.prepare(sql + ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page - 1) * limit);

      res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  function detectProvider(body) {
    if (!body) return '';
    if (body.TerminalKey && body.PaymentId) return 'tbank';
    if (body.TransactionId) return 'cloudpayments';
    if (body.event || body.object?.id) return 'yookassa';
    return '';
  }

  // === Webhook ===
  app.post('/api/webhooks/payment', async (req, res) => {
    const provider = req.headers['x-provider'] || req.body?.provider || detectProvider(req.body) || '';
    const p = PROVIDERS[provider];
    let logStatus = 'processed';
    let logError = '';

    try {
      if (!p) {
        logStatus = 'error';
        logError = 'Неизвестный провайдер';
        return res.status(400).json({ error: logError });
      }

      const credentials = getCredentials(db, provider);
      if (!credentials) {
        logStatus = 'error';
        logError = 'Провайдер не настроен';
        return res.status(403).json({ error: logError });
      }

      if (!p.verifyWebhookSignature(req, credentials)) {
        logStatus = 'error';
        logError = 'Неверная подпись webhook';
        res.status(403).json({ error: logError });
        return;
      }

      const event = p.normalizeWebhookEvent(req);
      if (!event || !event.paymentId) {
        logStatus = 'error';
        logError = 'Неверный формат события';
        res.status(400).json({ error: logError });
        return;
      }

      const payment = db.prepare('SELECT * FROM payments WHERE external_payment_id = ?').get(event.paymentId);
      if (!payment) {
        console.warn(`[WEBHOOK] Payment not found for external ID: ${event.paymentId}`);
        logStatus = 'ignored';
        logError = 'Платёж не найден в БД';
        res.json({ ok: true, ignored: true, reason: logError });
        return;
      }

      // ── Idempotency: skip if payment already in a terminal state ──
      const terminalStatuses = ['succeeded', 'failed', 'refunded', 'canceled'];
      if (terminalStatuses.includes(payment.status) && payment.status !== 'pending') {
        logStatus = 'ignored';
        logError = `Пропущен дубликат: текущий статус "${payment.status}" уже терминальный`;
        console.log(`[WEBHOOK] ${logError} (external_payment_id=${event.paymentId})`);
        res.json({ ok: true, ignored: true, reason: logError });
        return;
      }

      const newStatus = event.status;

      db.prepare("UPDATE payments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, payment.id);

      if (newStatus === 'succeeded' && payment.order_id) {
        db.prepare("UPDATE orders SET status = 'paid', is_paid = 1, is_paid_online = 1, updated_at = datetime('now') WHERE id = ?").run(payment.order_id);
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(payment.order_id, 'paid', `Оплачено онлайн (${PROVIDER_NAMES[provider] || provider})`);
        const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
        if (io) io.emit('order:update', updatedOrder);
        if (broadcast) broadcast({ type: 'order:update', orderId: payment.order_id, status: 'paid' });
        if (broadcast) broadcast({ type: 'payment:notification', message: `Новая оплата на сумму ${payment.amount}₽`, payment: { id: payment.id, orderId: payment.order_id, amount: payment.amount, provider: PROVIDER_NAMES[provider] || provider } });
      }

      if (newStatus === 'succeeded' && payment.subscription_id) {
        const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(payment.subscription_id);
        if (sub && sub.auto_renew) {
          const tariff = db.prepare('SELECT * FROM tariffs WHERE id = ?').get(sub.tariff_id);
          const periodMonths = tariff?.period === 'year' ? 12 : 1;
          const newEnd = new Date();
          newEnd.setMonth(newEnd.getMonth() + periodMonths);
          db.prepare("UPDATE subscriptions SET status = 'active', end_date = ?, payment_id = ?, updated_at = datetime('now') WHERE id = ?").run(
            newEnd.toISOString(), payment.id, payment.subscription_id
          );
        }
      }

      if (newStatus === 'refunded' && payment.order_id) {
        db.prepare("UPDATE orders SET is_paid = 0, is_paid_online = 0, updated_at = datetime('now') WHERE id = ?").run(payment.order_id);
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(payment.order_id, 'refunded', `Возврат через ${PROVIDER_NAMES[provider] || provider}`);
        const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
        if (io) io.emit('order:update', updatedOrder);
        if (broadcast) broadcast({ type: 'order:update', orderId: payment.order_id, status: 'refunded' });
      }

      if ((newStatus === 'canceled' || newStatus === 'failed') && payment.order_id) {
        db.prepare("UPDATE orders SET status = 'payment_failed', is_paid = 0, is_paid_online = 0, payment_error = ?, updated_at = datetime('now') WHERE id = ?").run(
          `Ошибка оплаты: ${event.metadata?.Description || event.metadata?.message || ''}`, payment.order_id
        );
        if (!db.prepare("SELECT id FROM order_status_history WHERE order_id = ? AND status = 'payment_failed'").get(payment.order_id)) {
          db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(payment.order_id, 'payment_failed', `Ошибка оплаты (${PROVIDER_NAMES[provider] || provider})`);
        }
        const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
        if (io) io.emit('order:update', updatedOrder);
        if (broadcast) broadcast({ type: 'order:update', orderId: payment.order_id, status: 'payment_failed' });
        if (broadcast) broadcast({ type: 'payment:notification', message: `Ошибка оплаты на сумму ${payment.amount}₽`, payment: { id: payment.id, orderId: payment.order_id, amount: payment.amount, error: true, provider: PROVIDER_NAMES[provider] || provider } });
      }

      logStatus = 'processed';
      res.json({ ok: true, event: event.event, status: newStatus });
    } catch (e) {
      console.error('PAYMENT_WEBHOOK_ERROR:', e.message);
      logStatus = 'error';
      logError = e.message;
      try { res.status(500).json({ error: safeError(e.message) }); } catch {}
    } finally {
      // ── Log to webhook_logs for audit ──
      try {
        const payload = JSON.stringify(req.body || {});
        const signature = req.body?.Token || req.headers['x-signature'] || '';
        db.prepare(`INSERT INTO webhook_logs (tenant_id, provider, payment_id, payload, signature, status, error_message, processed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
          1, provider, req.body?.PaymentId || '', payload, signature, logStatus, logError
        );
      } catch (logErr) {
        console.error('WEBHOOK_LOG_ERROR:', logErr.message);
      }
    }
  });

  // === Tariffs ===
  app.get('/api/tariffs', (req, res) => {
    try {
      const tariffs = db.prepare('SELECT * FROM tariffs WHERE is_active = 1 ORDER BY sort_order').all();
      res.json(tariffs.map(t => ({ ...t, features: (() => { try { return JSON.parse(t.features); } catch { return []; } })() })));
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.post('/api/admin/tariffs', (req, res) => {
    try {
      const { name, price, period, description, features, sort_order } = req.body;
      if (!name || !price) return res.status(400).json({ error: 'name и price обязательны' });
      const info = db.prepare('INSERT INTO tariffs (name, price, period, description, features, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
        name, price, period || 'month', description || '', JSON.stringify(features || []), sort_order || 0
      );
      const tariff = db.prepare('SELECT * FROM tariffs WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(tariff);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.put('/api/admin/tariffs/:id', (req, res) => {
    try {
      const { name, price, period, description, features, is_active, sort_order } = req.body;
      const sets = []; const vals = [];
      if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
      if (price !== undefined) { sets.push('price = ?'); vals.push(price); }
      if (period !== undefined) { sets.push('period = ?'); vals.push(period); }
      if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
      if (features !== undefined) { sets.push('features = ?'); vals.push(JSON.stringify(features)); }
      if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
      if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
      if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
      vals.push(req.params.id);
      db.prepare(`UPDATE tariffs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      const tariff = db.prepare('SELECT * FROM tariffs WHERE id = ?').get(req.params.id);
      res.json(tariff);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.delete('/api/admin/tariffs/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM tariffs WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === Subscriptions ===
  app.get('/api/subscriptions', (req, res) => {
    try {
      const tenantId = req.query.tenant_id || 1;
      const subs = db.prepare('SELECT s.*, t.name as tariff_name, t.price as tariff_price FROM subscriptions s LEFT JOIN tariffs t ON t.id = s.tariff_id WHERE s.tenant_id = ? ORDER BY s.created_at DESC').all(tenantId);
      res.json(subs);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.post('/api/subscriptions/create', (req, res) => {
    try {
      const { tenantId, tariffId } = req.body;
      if (!tariffId) return res.status(400).json({ error: 'tariffId обязателен' });
      const tariff = db.prepare('SELECT * FROM tariffs WHERE id = ? AND is_active = 1').get(tariffId);
      if (!tariff) return res.status(404).json({ error: 'Тариф не найден' });

      const now = new Date();
      const periodMonths = tariff.period === 'year' ? 12 : 1;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + periodMonths);

      const info = db.prepare('INSERT INTO subscriptions (tenant_id, tariff_id, start_date, end_date, status, auto_renew) VALUES (?, ?, ?, ?, ?, ?)').run(
        tenantId || 1, tariffId, now.toISOString(), endDate.toISOString(), 'active', 1
      );
      const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(sub);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.put('/api/subscriptions/:id', (req, res) => {
    try {
      const { auto_renew, status } = req.body;
      const sets = ["updated_at = datetime('now')"]; const vals = [];
      if (auto_renew !== undefined) { sets.push('auto_renew = ?'); vals.push(auto_renew ? 1 : 0); }
      if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
      if (sets.length <= 1) return res.status(400).json({ error: 'Нет полей для обновления' });
      vals.push(req.params.id);
      db.prepare(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // === Payment methods for guest app ===
  app.get('/api/active-payment-methods', (req, res) => {
    try {
      const activeProviders = db.prepare('SELECT provider, test_mode, sbp_enabled, sber_enabled FROM payment_settings WHERE enabled = 1').all();
      const methods = [];
      for (const p of activeProviders) {
        if (p.provider === 'tbank') {
          methods.push(
            { id: `${p.provider}_card`, key: `${p.provider}_card`, name: `Карта (${PROVIDER_NAMES[p.provider] || p.provider})`, provider: p.provider, paymentMethod: 'card', testMode: p.test_mode },
            { id: `${p.provider}_sbp_card`, key: `${p.provider}_sbp_card`, name: `СБП (${PROVIDER_NAMES[p.provider] || p.provider})`, provider: p.provider, paymentMethod: 'sbp', testMode: p.test_mode },
          );
          if (p.sbp_enabled) {
            methods.push(
              { id: `sbp_qr`, key: `sbp_qr`, name: 'СБП через QR-код', provider: p.provider, paymentMethod: 'sbp_qr', testMode: p.test_mode },
            );
          }
        } else if (p.provider === 'sberbank' && p.sber_enabled) {
          methods.push(
            { id: `sber_qr`, key: `sber_qr`, name: 'Сбербанк (SberPay)', provider: p.provider, paymentMethod: 'sber_qr', testMode: p.test_mode },
          );
        }
      }
      res.json(methods);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });
}

module.exports = { initTables, setupRoutes, PROVIDERS, PROVIDER_NAMES, PAYMENT_METHOD_LABELS };
