const https = require('https');
const http = require('http');

// ─── Driver registry ──────────────────────────────────────────
const DRIVERS = {
  atol: {
    name: 'Атол',
    testFn: testAtolConnection,
    printFn: printAtolReceipt,
  },
  shtrih: {
    name: 'Штрих-М',
    testFn: testShtrihConnection,
    printFn: printShtrihReceipt,
  },
  evotor: {
    name: 'Эвотор',
    testFn: testEvotorConnection,
    printFn: printEvotorReceipt,
  },
};

// ─── HTTP helper ───────────────────────────────────────────────
function apiRequest(url, method, body, timeout = 15000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout,
      };
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
        });
      });
      req.on('error', e => resolve({ ok: false, status: 0, data: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, data: 'Timeout' }); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    } catch (e) { resolve({ ok: false, status: 0, data: e.message }); }
  });
}

// ─── ATOL cloud driver ─────────────────────────────────────────
async function testAtolConnection(settings) {
  const { ip, port, login, password } = settings;
  if (ip) {
    // Local ATOL over TCP
    const result = await apiRequest(`http://${ip}:${port || 7777}/api/v1/status`, 'GET');
    return result.ok ? { ok: true, data: 'Касса Атол доступна' } : { ok: false, data: result.data || 'Не удалось подключиться к Атол' };
  }
  // Cloud ATOL Online API
  if (settings.api_key) {
    const url = 'https://online.atol.ru/possystem/v4/getToken';
    const result = await apiRequest(url, 'POST', { login: settings.login, pass: settings.password });
    if (result.ok && result.data?.token) return { ok: true, data: 'Токен получен' };
    return { ok: false, data: result.data?.error?.text || result.data || 'Ошибка авторизации Атол' };
  }
  return { ok: false, data: 'Не указаны параметры подключения Атол' };
}

async function printAtolReceipt(settings, receipt, db, tenantId) {
  const { ip, port, login, password, api_key, group_code } = settings;
  const payload = buildFiscalPayload(receipt, settings);

  if (ip) {
    // Local ATOL via HTTP API
    const result = await apiRequest(`http://${ip}:${port || 7777}/api/v1/sell`, 'POST', payload);
    return result;
  }

  // Cloud ATOL Online
  if (api_key && group_code) {
    // Get token
    const tokenRes = await apiRequest('https://online.atol.ru/possystem/v4/getToken', 'POST', { login: settings.login, pass: settings.password });
    if (!tokenRes.ok || !tokenRes.data?.token) return { ok: false, data: 'Не удалось получить токен Атол' };
    const token = tokenRes.data.token;
    const url = `https://online.atol.ru/possystem/v4/${group_code}/sell`;
    const result = await apiRequest(url, 'POST', { ...payload, token, external_id: String(receipt.orderId || receipt.id) });
    return result;
  }

  return { ok: false, data: 'Настройки Атол не указаны' };
}

// ─── SHTRIKH-M driver ──────────────────────────────────────────
async function testShtrihConnection(settings) {
  if (settings.ip) {
    const result = await apiRequest(`http://${settings.ip}:${settings.port || 5555}/api/status`, 'GET');
    return result.ok ? { ok: true, data: 'Касса Штрих-М доступна' } : { ok: false, data: result.data || 'Не удалось подключиться к Штрих-М' };
  }
  return { ok: false, data: 'Укажите IP-адрес кассы Штрих-М' };
}

async function printShtrihReceipt(settings, receipt, db, tenantId) {
  const { ip, port } = settings;
  if (!ip) return { ok: false, data: 'IP кассы Штрих-М не указан' };
  const payload = buildFiscalPayload(receipt, settings);
  const result = await apiRequest(`http://${ip}:${port || 5555}/api/sell`, 'POST', payload);
  return result;
}

// ─── EVOTOR driver ─────────────────────────────────────────────
async function testEvotorConnection(settings) {
  if (settings.ip) {
    const result = await apiRequest(`http://${settings.ip}:${settings.port || 7778}/api/v1/status`, 'GET');
    return result.ok ? { ok: true, data: 'Касса Эвотор доступна' } : { ok: false, data: result.data || 'Не удалось подключиться к Эвотор' };
  }
  return { ok: false, data: 'Укажите IP-адрес кассы Эвотор' };
}

async function printEvotorReceipt(settings, receipt, db, tenantId) {
  const { ip, port, login, password } = settings;
  if (!ip) return { ok: false, data: 'IP кассы Эвотор не указан' };
  const payload = buildFiscalPayload(receipt, settings);
  const result = await apiRequest(`http://${ip}:${port || 7778}/api/v1/receipt`, 'POST', payload);
  return result;
}

// ─── Build universal fiscal payload ────────────────────────────
function buildFiscalPayload(receipt, settings) {
  const items = (receipt.items || []).map((item, i) => ({
    name: item.name || `Товар ${i + 1}`,
    price: item.price || 0,
    quantity: item.quantity || 1,
    sum: Math.round((item.price || 0) * (item.quantity || 1) * 100) / 100,
    measurement_unit: item.unit || 'шт',
    payment_method: 'full_payment',
    payment_object: 'commodity',
    vat: settings.vat || 'none',
  }));

  const total = items.reduce((s, i) => s + i.sum, 0);
  const cashSum = receipt.paymentMethod === 'cash' ? total : 0;
  const cardSum = receipt.paymentMethod === 'card' || receipt.paymentMethod !== 'cash' ? total : 0;

  return {
    type: receipt.type || 'sell',
    timestamp: new Date().toISOString(),
    external_id: String(receipt.orderId || receipt.id),
    user: receipt.userName || 'Гость',
    phone: receipt.userPhone || '',
    email: receipt.userEmail || '',
    inn: settings.inn || '',
    payment_address: settings.payment_address || '',
    items,
    total: Math.round(total * 100) / 100,
    payments: [
      ...(cashSum > 0 ? [{ type: 'cash', sum: Math.round(cashSum * 100) / 100 }] : []),
      ...(cardSum > 0 ? [{ type: 'card', sum: Math.round(cardSum * 100) / 100 }] : []),
    ],
    vat: settings.vat || 'none',
    should_print: settings.print_receipt !== false,
  };
}

// ─── Main receipt printing function ────────────────────────────
async function printReceipt(settings, receipt, db, tenantId) {
  const driver = DRIVERS[settings.provider];
  if (!driver) return { ok: false, data: `Неизвестный тип кассы: ${settings.provider}` };

  try {
    const result = await driver.printFn(settings, receipt, db, tenantId);
    return result;
  } catch (e) {
    return { ok: false, data: e.message };
  }
}

async function testConnection(settings) {
  const driver = DRIVERS[settings.provider];
  if (!driver) return { ok: false, data: `Неизвестный тип кассы: ${settings.provider}` };
  return driver.testFn(settings);
}

// ─── Settings CRUD ─────────────────────────────────────────────
function getSettings(db, tenantId = 1) {
  const rows = db.prepare('SELECT * FROM fiscal_settings WHERE tenant_id = ?').all(tenantId);
  if (rows.length === 0) {
    db.prepare('INSERT INTO fiscal_settings (tenant_id, provider, enabled, settings, is_test) VALUES (?, ?, ?, ?, ?)').run(tenantId, 'atol', 0, JSON.stringify({
      ip: '', port: 7777, login: '', password: '', api_key: '', group_code: '',
      inn: '', payment_address: '', vat: 'none', print_receipt: true,
    }), 1);
    return db.prepare('SELECT * FROM fiscal_settings WHERE tenant_id = ?').all(tenantId);
  }
  return rows;
}

function updateSettings(db, tenantId, provider, data) {
  const existing = db.prepare('SELECT id FROM fiscal_settings WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
  if (existing) {
    db.prepare("UPDATE fiscal_settings SET enabled = ?, settings = ?, is_test = ?, updated_at = datetime('now') WHERE id = ?")
      .run(data.enabled ? 1 : 0, JSON.stringify(data.settings || {}), data.is_test ? 1 : 0, existing.id);
  } else {
    db.prepare('INSERT INTO fiscal_settings (tenant_id, provider, enabled, settings, is_test) VALUES (?, ?, ?, ?, ?)')
      .run(tenantId, provider, data.enabled ? 1 : 0, JSON.stringify(data.settings || {}), data.is_test ? 1 : 0);
  }
}

// ─── Receipt queue management ──────────────────────────────────
function createReceipt(db, order, paymentMethod, tenantId = 1) {
  const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();
  const info = db.prepare(`
    INSERT INTO fiscal_receipts (tenant_id, order_id, receipt_type, items_json, total, payment_method, user_name, user_phone, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(tenantId, order.id, 'sell', JSON.stringify(items), order.total || 0, paymentMethod || order.payment_method || 'cash', order.user_name || '', order.user_phone || '');
  return info.lastInsertRowid;
}

function createRefundReceipt(db, order, reason, tenantId = 1) {
  const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();
  const info = db.prepare(`
    INSERT INTO fiscal_receipts (tenant_id, order_id, receipt_type, items_json, total, payment_method, user_name, user_phone, status, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
  `).run(tenantId, order.id, 'refund', JSON.stringify(items), -(order.total || 0), order.payment_method || 'cash', order.user_name || '', order.user_phone || '', reason || 'Возврат заказа');
  return info.lastInsertRowid;
}

async function processPendingReceipts(db, tenantId = 1) {
  const pending = db.prepare("SELECT * FROM fiscal_receipts WHERE tenant_id = ? AND status = 'pending' ORDER BY created_at LIMIT 10").all(tenantId);
  const kktSettings = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = ? AND enabled = 1").all(tenantId);

  if (kktSettings.length === 0) return { processed: 0, message: 'Нет активных касс' };
  if (pending.length === 0) return { processed: 0, message: 'Нет ожидающих чеков' };

  let processed = 0;
  for (const kkt of kktSettings) {
    const kktSettingsParsed = (() => { try { return JSON.parse(kkt.settings || '{}'); } catch { return {}; } })();
    for (const receipt of pending) {
      try {
        const items = (() => { try { return JSON.parse(receipt.items_json || '[]'); } catch { return []; } })();
        const fiscalReceipt = {
          id: receipt.id,
          orderId: receipt.order_id,
          type: receipt.receipt_type,
          items,
          total: receipt.total,
          paymentMethod: receipt.payment_method,
          userName: receipt.user_name,
          userPhone: receipt.user_phone,
        };
        const result = await printReceipt({ ...kktSettingsParsed, provider: kkt.provider, is_test: kkt.is_test }, fiscalReceipt, db, tenantId);
        if (result.ok) {
          db.prepare("UPDATE fiscal_receipts SET status = 'printed', sent_at = datetime('now'), error = NULL, receipt_data = ? WHERE id = ?")
            .run(JSON.stringify(result.data), receipt.id);
          processed++;
        } else {
          db.prepare("UPDATE fiscal_receipts SET status = 'error', error = ?, attempts = attempts + 1 WHERE id = ?")
            .run(result.data?.message || result.data || 'Unknown error', receipt.id);
        }
      } catch (e) {
        db.prepare("UPDATE fiscal_receipts SET status = 'error', error = ?, attempts = attempts + 1 WHERE id = ?")
          .run(e.message, receipt.id);
      }
    }
  }
  return { processed, total: pending.length };
}

async function printReceiptById(db, receiptId, tenantId = 1) {
  const receipt = db.prepare('SELECT * FROM fiscal_receipts WHERE id = ? AND tenant_id = ?').get(receiptId, tenantId);
  if (!receipt) return { ok: false, data: 'Чек не найден' };

  const kktSettings = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = ? AND enabled = 1").all(tenantId);
  if (kktSettings.length === 0) return { ok: false, data: 'Нет активных касс' };

  const results = [];
  for (const kkt of kktSettings) {
    const kktSettingsParsed = (() => { try { return JSON.parse(kkt.settings || '{}'); } catch { return {}; } })();
    const items = (() => { try { return JSON.parse(receipt.items_json || '[]'); } catch { return []; } })();
    const fiscalReceipt = {
      id: receipt.id,
      orderId: receipt.order_id,
      type: receipt.receipt_type,
      items,
      total: receipt.total,
      paymentMethod: receipt.payment_method,
      userName: receipt.user_name,
      userPhone: receipt.user_phone,
    };
    const result = await printReceipt({ ...kktSettingsParsed, provider: kkt.provider, is_test: kkt.is_test }, fiscalReceipt, db, tenantId);
    results.push(result);
    if (result.ok) {
      db.prepare("UPDATE fiscal_receipts SET status = 'printed', sent_at = datetime('now'), error = NULL, receipt_data = ? WHERE id = ?")
        .run(JSON.stringify(result.data), receipt.id);
    } else {
      db.prepare("UPDATE fiscal_receipts SET status = 'error', error = ?, attempts = attempts + 1 WHERE id = ?")
        .run(result.data?.message || result.data || 'Unknown error', receipt.id);
    }
  }
  return results[0] || { ok: false, data: 'Ошибка печати' };
}

module.exports = {
  getSettings, updateSettings, testConnection, printReceipt,
  createReceipt, createRefundReceipt, processPendingReceipts, printReceiptById,
};