// ─── POS Terminal Integration Service ─────────────────────────────
// Supports: INPAS SmartSale, Sberbank, Atol (driver), Verifone
// All drivers use HTTP API (no hardware libraries)

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const cryptoUtils = require(path.join(__dirname, '..', 'crypto-utils'));

const RETRY_MAX_ATTEMPTS = 5;
const RETRY_INTERVAL_MS = 15000;
const retryTimers = new Map();

// ─── DRIVERS ──────────────────────────────────────────────────────

function buildInpasRequest(amount, orderId, terminalId) {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'sale',
    id: orderId,
    params: {
      amount: Math.round(amount * 100),
      currency: 'RUB',
      terminal_id: terminalId,
      order_id: String(orderId),
      auto_close: true,
      timeout: 60,
    },
  });
}

function parseInpasResponse(body) {
  try {
    const data = JSON.parse(body);
    if (data.result?.status === 'ok' || data.result?.status === 'success') {
      return { success: true, rrn: data.result.rrn, authCode: data.result.auth_code, transactionId: data.result.transaction_id || String(data.id), raw: data };
    }
    return { success: false, error: data.error?.message || data.result?.error_message || 'Unknown error', raw: data };
  } catch { return { success: false, error: 'Invalid response from terminal', raw: body }; }
}

function buildSberRequest(amount, orderId) {
  return JSON.stringify({
    terminal_id: '',
    amount: Math.round(amount * 100),
    currency: 'RUB',
    order_number: String(orderId),
    description: `Оплата заказа #${orderId}`,
    language: 'RU',
  });
}

function parseSberResponse(body) {
  try {
    const data = JSON.parse(body);
    if (data.errorCode === '0' && data.status === '1') {
      return { success: true, rrn: data.rrn, authCode: data.authCode, transactionId: data.orderId, raw: data };
    }
    return { success: false, error: data.errorMessage || data.errorCode || 'Unknown error', raw: data };
  } catch { return { success: false, error: 'Invalid response from terminal', raw: body }; }
}

function buildAtolRequest(amount, orderId, login, password) {
  const payload = {
    operation: 'sell',
    timestamp: new Date().toISOString(),
    total: amount,
    receipt: {
      items: [{ name: `Заказ #${orderId}`, price: amount, quantity: 1, sum: amount, tax: { type: 'none' } }],
      total: amount,
      payments: [{ type: 1, sum: amount }],
    },
  };
  return JSON.stringify(payload);
}

function parseAtolResponse(body) {
  try {
    const data = JSON.parse(body);
    if (data.uuid && data.status !== 'fail') {
      return { success: true, rrn: data.uuid, authCode: '', transactionId: data.uuid, raw: data };
    }
    return { success: false, error: data.error?.text || data.error_description || 'Unknown error', raw: data };
  } catch { return { success: false, error: 'Invalid response from terminal', raw: body }; }
}

function buildVerifoneRequest(amount, orderId) {
  return JSON.stringify({
    request_type: 'sale',
    transaction_id: orderId,
    amount: amount.toFixed(2),
    currency: 'RUB',
    capture: true,
  });
}

function parseVerifoneResponse(body) {
  try {
    const data = JSON.parse(body);
    if (data.response_type === 'sale' && data.status === 'approved') {
      return { success: true, rrn: data.rrn || data.transaction_id, authCode: data.auth_code, transactionId: data.transaction_id, raw: data };
    }
    return { success: false, error: data.status_reason || data.status || 'Unknown error', raw: data };
  } catch { return { success: false, error: 'Invalid response from terminal', raw: body }; }
}

const DRIVERS = {
  inpas: {
    buildRequest: buildInpasRequest,
    parseResponse: parseInpasResponse,
    testConnection: (settings) => {
      const body = JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1, params: {} });
      return sendHttp(settings.ip, settings.port || 8000, body, settings.timeout || 5000);
    },
  },
  sber: {
    buildRequest: buildSberRequest,
    parseResponse: parseSberResponse,
    testConnection: (settings) => {
      const body = JSON.stringify({ command: 'status', terminal_id: settings.terminalId || '' });
      return sendHttp(settings.ip, settings.port || 8080, body, settings.timeout || 5000);
    },
  },
  atol: {
    buildRequest: buildAtolRequest,
    parseResponse: parseAtolResponse,
    testConnection: (settings) => {
      const body = JSON.stringify({ operation: 'ping', timestamp: new Date().toISOString() });
      return sendHttp(settings.ip, settings.port || 2101, body, settings.timeout || 5000);
    },
  },
  verifone: {
    buildRequest: buildVerifoneRequest,
    parseResponse: parseVerifoneResponse,
    testConnection: (settings) => {
      const body = JSON.stringify({ request_type: 'echo', transaction_id: 0 });
      return sendHttp(settings.ip, settings.port || 8000, body, settings.timeout || 5000);
    },
  },
};

function sendHttp(host, port, body, timeout = 5000) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: host, port: Number(port), method: 'POST', path: '/', timeout, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ ok: true, data, statusCode: res.statusCode }));
      }
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.write(body);
  });
}

// ─── SERVICE ──────────────────────────────────────────────────────

function getSettings(db, tenantId) {
  const row = db.prepare('SELECT * FROM terminal_settings WHERE tenant_id = ?').get(tenantId);
  if (!row) return { provider: 'inpas', ip: '192.168.1.100', port: 8000, terminalId: '', login: '', password: '', enabled: false };
  return { ...row, password: cryptoUtils.decrypt(row.password || '') };
}

function saveSettings(db, tenantId, data) {
  const existing = db.prepare('SELECT id FROM terminal_settings WHERE tenant_id = ?').get(tenantId);
  const { provider, ip, port, terminalId, login, password, enabled } = data;
  const encryptedPassword = cryptoUtils.encrypt(password || '');
  if (existing) {
    db.prepare('UPDATE terminal_settings SET provider = ?, ip = ?, port = ?, terminal_id = ?, login = ?, password = ?, enabled = ? WHERE tenant_id = ?')
      .run(provider || 'inpas', ip || '', Number(port) || 8000, terminalId || '', login || '', encryptedPassword, enabled !== false ? 1 : 0, tenantId);
  } else {
    db.prepare('INSERT INTO terminal_settings (tenant_id, provider, ip, port, terminal_id, login, password, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(tenantId, provider || 'inpas', ip || '', Number(port) || 8000, terminalId || '', login || '', encryptedPassword, enabled !== false ? 1 : 0);
  }
  return getSettings(db, tenantId);
}

function testConnection(db, tenantId) {
  const settings = getSettings(db, tenantId);
  const driver = DRIVERS[settings.provider];
  if (!driver) return { ok: false, error: `Unknown provider: ${settings.provider}` };
  return driver.testConnection(settings).then(result => ({ ok: result.ok, error: result.error, statusCode: result.statusCode }));
}

async function initPayment(db, tenantId, orderId, amount, io) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled) return { success: false, error: 'Terminal not enabled' };

  const driver = DRIVERS[settings.provider];
  if (!driver) return { success: false, error: `Unknown provider: ${settings.provider}` };

  const requestBody = driver.buildRequest(amount, orderId, settings.terminalId);
  const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  db.prepare('INSERT OR IGNORE INTO terminal_transactions (transaction_id, tenant_id, order_id, amount, status, request_body) VALUES (?, ?, ?, ?, ?, ?)')
    .run(transactionId, tenantId, orderId, amount, 'pending', requestBody);

  logOperation(db, tenantId, orderId, amount, 'init', 'pending', '', '');

  const result = await sendHttp(settings.ip, settings.port || 8000, requestBody, settings.timeout || 30000);

  if (!result.ok) {
    // ── Offline retry: queue for later ──
    const attempts = 0;
    db.prepare('UPDATE terminal_transactions SET status = ?, error_message = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
      .run('retrying', result.error || 'Connection failed', transactionId);
    logOperation(db, tenantId, orderId, amount, 'init', 'retrying', result.error || 'Connection failed', '');
    if (io) io.emit('payment_status_changed', { transactionId, orderId, status: 'retrying', error: result.error || 'Connection failed' });

    scheduleRetry(db, tenantId, transactionId, orderId, amount, requestBody, attempts + 1, io);

    return { success: false, error: result.error || 'Terminal connection failed', transactionId, retrying: true };
  }

  const parsed = driver.parseResponse(result.data);
  if (parsed.success) {
    db.prepare('UPDATE terminal_transactions SET status = ?, terminal_response = ?, rrn = ?, auth_code = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
      .run('success', JSON.stringify(parsed.raw), parsed.rrn || '', parsed.authCode || '', transactionId);
    logOperation(db, tenantId, orderId, amount, 'init', 'success', '', parsed.rrn || '');

    // Auto-close order
    try {
      const activeShift = db.prepare("SELECT id FROM cashier_shifts WHERE status = 'open' AND tenant_id = ? LIMIT 1").get(tenantId);
      const shiftId = activeShift ? activeShift.id : 0;
      db.prepare("UPDATE orders SET payment_method = 'card', is_paid = 1, status = 'paid', updated_at = datetime('now'), terminal_transaction_id = ?, shift_id = ? WHERE id = ?").run(transactionId, shiftId, orderId);
      db.prepare("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)").run(orderId, 'paid', 'Оплата картой через терминал');

      // Auto-print fiscal receipt if module configured
      try {
        const fiscalService = require('./fiscalization.service');
        if (fiscalService && fiscalService.printReceipt) {
          fiscalService.printReceipt(db, orderId).catch(() => {});
        }
      } catch {}

      if (io) {
        io.emit('payment_status_changed', { transactionId, orderId, status: 'success', rrn: parsed.rrn });
        io.emit('order:update', getOrderFull(db, orderId));
      }

      // Close check
      try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        if (order && order.check_id) {
          const others = db.prepare("SELECT * FROM orders WHERE check_id = ? AND id != ? AND status NOT IN ('closed','cancelled')").all(order.check_id, orderId);
          if (others.length === 0) {
            db.prepare("UPDATE dine_in_checks SET status = 'closed' WHERE id = ?").run(order.check_id);
          }
        }
      } catch {}
    } catch (e) { console.error('[Terminal] Order close error:', e.message); }

    return { success: true, transactionId, rrn: parsed.rrn, authCode: parsed.authCode };
  }

  db.prepare('UPDATE terminal_transactions SET status = ?, error_message = ?, terminal_response = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
    .run('error', parsed.error, JSON.stringify(parsed.raw), transactionId);
  logOperation(db, tenantId, orderId, amount, 'init', 'error', parsed.error, '');
  if (io) io.emit('payment_status_changed', { transactionId, orderId, status: 'error', error: parsed.error });
  return { success: false, error: parsed.error, transactionId };
}

function checkStatus(db, transactionId) {
  const row = db.prepare('SELECT * FROM terminal_transactions WHERE transaction_id = ?').get(transactionId);
  return row ? { status: row.status, transactionId: row.transaction_id, rrn: row.rrn, authCode: row.auth_code, errorMessage: row.error_message, amount: row.amount, createdAt: row.created_at } : null;
}

async function cancelPayment(db, tenantId, transactionId, io) {
  const txn = db.prepare('SELECT * FROM terminal_transactions WHERE transaction_id = ?').get(transactionId);
  if (!txn) return { success: false, error: 'Transaction not found' };

  db.prepare('UPDATE terminal_transactions SET status = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?').run('cancelled', transactionId);
  logOperation(db, tenantId, txn.order_id, txn.amount, 'cancel', 'cancelled', '', '');
  if (io) io.emit('payment_status_changed', { transactionId, orderId: txn.order_id, status: 'cancelled' });
  return { success: true };
}

function logOperation(db, tenantId, orderId, amount, operation, status, errorMessage, rrn) {
  try {
    db.prepare('INSERT INTO terminal_logs (tenant_id, order_id, amount, operation, status, error_message, rrn) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(tenantId, orderId || 0, amount || 0, operation, status, errorMessage || '', rrn || '');
  } catch {}
}

function getOrderFull(db, orderId) {
  try {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  } catch { return {}; }
}

// ─── Offline Retry Queue ──────────────────────────────────────

function scheduleRetry(db, tenantId, transactionId, orderId, amount, requestBody, attempt, io) {
  if (attempt > RETRY_MAX_ATTEMPTS) {
    db.prepare('UPDATE terminal_transactions SET status = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
      .run('failed', transactionId);
    logOperation(db, tenantId, orderId, amount, 'retry_exhausted', 'failed', `Exceeded ${RETRY_MAX_ATTEMPTS} retries`, '');
    if (io) io.emit('payment_status_changed', { transactionId, orderId, status: 'failed', error: 'Терминал недоступен после нескольких попыток' });
    retryTimers.delete(transactionId);
    return;
  }

  const timer = setTimeout(async () => {
    try {
      const settings = getSettings(db, tenantId);
      if (!settings.enabled) {
        db.prepare('UPDATE terminal_transactions SET status = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
          .run('cancelled', transactionId);
        logOperation(db, tenantId, orderId, amount, 'retry_cancelled', 'cancelled', 'Terminal was disabled', '');
        retryTimers.delete(transactionId);
        return;
      }

      const result = await sendHttp(settings.ip, settings.port || 8000, requestBody, settings.timeout || 15000);
      if (result.ok) {
        const driver = DRIVERS[settings.provider];
        if (!driver) {
          db.prepare('UPDATE terminal_transactions SET status = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
            .run('error', transactionId);
          retryTimers.delete(transactionId);
          return;
        }
        const parsed = driver.parseResponse(result.data);
        if (parsed.success) {
          db.prepare('UPDATE terminal_transactions SET status = ?, terminal_response = ?, rrn = ?, auth_code = ?, updated_at = datetime(\'now\') WHERE transaction_id = ?')
            .run('success', JSON.stringify(parsed.raw), parsed.rrn || '', parsed.authCode || '', transactionId);
          logOperation(db, tenantId, orderId, amount, 'retry_success', 'success', '', parsed.rrn || '');

          // Auto-close order after retry success
          try {
            const currentOrder = db.prepare("SELECT status, is_paid FROM orders WHERE id = ?").get(orderId);
            if (currentOrder && currentOrder.status !== 'paid' && !currentOrder.is_paid) {
              const activeShift = db.prepare("SELECT id FROM cashier_shifts WHERE status = 'open' AND tenant_id = ? LIMIT 1").get(tenantId);
              const shiftId = activeShift ? activeShift.id : 0;
              db.prepare("UPDATE orders SET payment_method = 'card', is_paid = 1, status = 'paid', updated_at = datetime('now'), terminal_transaction_id = ?, shift_id = ? WHERE id = ?")
                .run(transactionId, shiftId, orderId);
              db.prepare("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)")
                .run(orderId, 'paid', 'Оплата картой (автоматически после восстановления связи)');
            }
          } catch {}

          if (io) {
            io.emit('payment_status_changed', { transactionId, orderId, status: 'success', rrn: parsed.rrn });
            io.emit('order:update', getOrderFull(db, orderId));
          }
          retryTimers.delete(transactionId);
          return;
        }
      }

      // Still failing — schedule next retry
      logOperation(db, tenantId, orderId, amount, 'retry', 'retrying', result.error || 'Still unavailable', '');
      scheduleRetry(db, tenantId, transactionId, orderId, amount, requestBody, attempt + 1, io);
    } catch (e) {
      console.error('[Terminal] Retry error:', e.message);
      scheduleRetry(db, tenantId, transactionId, orderId, amount, requestBody, attempt + 1, io);
    }
  }, RETRY_INTERVAL_MS);

  retryTimers.set(transactionId, timer);
}

function shutdownRetries() {
  for (const [txnId, timer] of retryTimers) {
    clearTimeout(timer);
  }
  retryTimers.clear();
}

module.exports = { getSettings, saveSettings, testConnection, initPayment, checkStatus, cancelPayment, logOperation, DRIVERS, shutdownRetries };
