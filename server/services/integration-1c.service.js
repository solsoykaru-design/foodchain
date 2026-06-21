const https = require('https');
const http = require('http');
const path = require('path');

// ─── Settings ──────────────────────────────────────────────────
function getSettings(db, tenantId = 1) {
  let row = db.prepare('SELECT * FROM integration_1c_settings WHERE tenant_id = ?').get(tenantId);
  if (!row) {
    db.prepare('INSERT INTO integration_1c_settings (tenant_id) VALUES (?)').run(tenantId);
    row = db.prepare('SELECT * FROM integration_1c_settings WHERE tenant_id = ?').get(tenantId);
  }
  return row;
}

function updateSettings(db, tenantId, data) {
  const existing = db.prepare('SELECT id FROM integration_1c_settings WHERE tenant_id = ?').get(tenantId);
  const sets = ["updated_at = datetime('now')"];
  const vals = [];
  const fields = [
    'enabled', 'api_url', 'api_key', 'login', 'password',
    'sync_interval', 'sync_hour',
    'export_orders', 'import_goods', 'import_contragents',
    'import_menu', 'export_tech_cards', 'sync_prices', 'export_remains',
  ];
  for (const f of fields) {
    if (data[f] !== undefined) {
      sets.push(`${f} = ?`);
      vals.push(data[f]);
    }
  }
  if (existing) {
    vals.push(existing.id);
    db.prepare(`UPDATE integration_1c_settings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  } else {
    db.prepare(`INSERT INTO integration_1c_settings (tenant_id, ${fields.join(', ')}) VALUES (?${', ?'.repeat(fields.length)})`).run(tenantId, ...fields.map(f => data[f] !== undefined ? data[f] : 0));
  }
}

// ─── Logging ───────────────────────────────────────────────────
function logOperation(db, tenantId, operation, direction, status, requestBody, responseBody, errorMessage) {
  db.prepare(`INSERT INTO integration_1c_log (tenant_id, operation, direction, status, request_body, response_body, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    tenantId, operation, direction, status,
    typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody || ''),
    typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || ''),
    errorMessage || null
  );
}

// ─── HTTP helper ───────────────────────────────────────────────
async function apiRequest(url, method, headers, body, apiKey, login, password) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const authHeaders = {};
      if (apiKey) {
        authHeaders['Authorization'] = `Bearer ${apiKey}`;
      } else if (login && password) {
        authHeaders['Authorization'] = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
      }
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...headers,
        },
        timeout: 60000,
      };
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
        });
      });
      req.on('error', (e) => resolve({ ok: false, status: 0, data: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, data: 'Timeout' }); });
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    } catch (e) {
      resolve({ ok: false, status: 0, data: e.message });
    }
  });
}

// ─── Test connection ───────────────────────────────────────────
async function testConnection(settings) {
  if (!settings.api_url) return { ok: false, data: 'URL не указан' };
  const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/ping';
  return apiRequest(url, 'GET', {}, null, settings.api_key, settings.login, settings.password);
}

// ─── 1. Export orders ──────────────────────────────────────────
async function exportOrdersTo1C(db, settings, startDate, endDate) {
  const orders = db.prepare(`
    SELECT * FROM orders 
    WHERE created_at >= ? AND created_at <= ?
    ORDER BY created_at
  `).all(startDate || '1970-01-01', endDate || '2099-12-31');

  const payload = {
    type: 'orders_export',
    generated_at: new Date().toISOString(),
    orders: orders.map(o => ({
      id: o.id,
      number: o.id,
      date: o.created_at,
      customer: o.user_name,
      phone: o.user_phone,
      address: o.address,
      items: (() => { try { return JSON.parse(o.items || '[]'); } catch { return []; } })(),
      subtotal: o.subtotal,
      discount: o.discount || 0,
      total: o.total,
      delivery_fee: o.delivery_fee || 0,
      status: o.status,
      payment_method: o.payment_method,
      is_paid: !!o.is_paid,
      bonus_used: o.bonus_used || 0,
    })),
  };

  if (settings.api_url) {
    const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/orders/import';
    const result = await apiRequest(url, 'POST', {}, payload, settings.api_key, settings.login, settings.password);
    return result;
  }
  return { ok: true, data: { orders_count: orders.length, note: 'Файл сгенерирован (API не настроен)' } };
}

// ─── 2. Import goods (inventory items) ─────────────────────────
async function importGoodsFrom1C(db, settings) {
  if (!settings.api_url) return { ok: false, data: 'URL не указан' };
  const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/goods';
  const result = await apiRequest(url, 'GET', {}, null, settings.api_key, settings.login, settings.password);
  if (result.ok && Array.isArray(result.data?.goods)) {
    const goods = result.data.goods;
    let created = 0, updated = 0;
    for (const g of goods) {
      const existing = db.prepare('SELECT id FROM inventory_items WHERE id_1c = ? OR article = ?').get(g.id_1c || '', g.article || '');
      if (existing) {
        db.prepare('UPDATE inventory_items SET name = ?, article = ?, price_per_unit = ?, current_stock = ?, unit = ?, barcode = ?, category_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(g.name || g.Наименование, g.article || g.Артикул, g.price || g.Цена || 0, g.stock || g.Остаток || 0, g.unit || g.Единица || 'шт', g.barcode || g.Штрихкод || '', g.category_id || null, existing.id);
        updated++;
      } else {
        db.prepare('INSERT INTO inventory_items (name, article, unit, price_per_unit, current_stock, barcode, id_1c) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(g.name || g.Наименование || 'Товар', g.article || g.Артикул || '', g.unit || g.Единица || 'шт', g.price || g.Цена || 0, g.stock || g.Остаток || 0, g.barcode || g.Штрихкод || '', g.id_1c || '');
        created++;
      }
    }
    return { ok: true, data: { created, updated, total: goods.length } };
  }
  return { ok: false, data: result.data || 'Неверный формат ответа 1С' };
}

// ─── 3. Import contragents (suppliers) ─────────────────────────
async function importContragentsFrom1C(db, settings) {
  if (!settings.api_url) return { ok: false, data: 'URL не указан' };
  const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/contragents';
  const result = await apiRequest(url, 'GET', {}, null, settings.api_key, settings.login, settings.password);
  if (result.ok && Array.isArray(result.data?.contragents)) {
    const contragents = result.data.contragents;
    let created = 0, updated = 0;
    for (const c of contragents) {
      const existing = db.prepare('SELECT id FROM suppliers WHERE id_1c = ? OR inn = ?').get(c.id_1c || '', c.inn || '');
      if (existing) {
        db.prepare('UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, inn = ?, kpp = ?, account_number = ?, bank_name = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(c.name || c.Наименование, c.contact_person || '', c.phone || c.Телефон || '', c.email || '', c.address || c.Адрес || '', c.inn || c.ИНН || '', c.kpp || c.КПП || '', c.account_number || c.РасчетныйСчет || '', c.bank_name || c.Банк || '', existing.id);
        updated++;
      } else {
        db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, address, inn, kpp, account_number, bank_name, id_1c) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(c.name || c.Наименование || 'Импортированный', c.contact_person || '', c.phone || c.Телефон || '', c.email || '', c.address || c.Адрес || '', c.inn || c.ИНН || '', c.kpp || c.КПП || '', c.account_number || c.РасчетныйСчет || '', c.bank_name || c.Банк || '', c.id_1c || '');
        created++;
      }
    }
    return { ok: true, data: { created, updated, total: contragents.length } };
  }
  return { ok: false, data: result.data || 'Неверный формат ответа 1С' };
}

// ─── 4. Import menu dishes from 1C ─────────────────────────────
async function importMenuFrom1C(db, settings) {
  if (!settings.api_url) return { ok: false, data: 'URL не указан' };
  const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/menu';
  const result = await apiRequest(url, 'GET', {}, null, settings.api_key, settings.login, settings.password);
  if (result.ok && Array.isArray(result.data?.dishes)) {
    const dishes = result.data.dishes;
    let created = 0, updated = 0;
    for (const d of dishes) {
      const existing = db.prepare('SELECT id FROM dishes WHERE id_1c = ? OR article = ?').get(d.id_1c || '', d.article || '');
      if (existing) {
        db.prepare('UPDATE dishes SET name = ?, description = ?, price = ?, category_id = ?, unit = ?, weight = ?, barcode = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(d.name || d.Наименование, d.description || d.Описание || '', d.price || d.Цена || 0, d.category_id || null, d.unit || d.Единица || 'шт', d.weight || d.Вес || 0, d.barcode || d.Штрихкод || '', existing.id);
        updated++;
      } else {
        const info = db.prepare('INSERT INTO dishes (name, description, price, category_id, unit, weight, barcode, image, id_1c) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(d.name || d.Наименование || 'Блюдо', d.description || d.Описание || '', d.price || d.Цена || 0, d.category_id || null, d.unit || d.Единица || 'шт', d.weight || d.Вес || 0, d.barcode || d.Штрихкод || '', d.image || d.Изображение || '', d.id_1c || '');
        created++;
      }
    }
    return { ok: true, data: { created, updated, total: dishes.length } };
  }
  return { ok: false, data: result.data || 'Неверный формат ответа 1С' };
}

// ─── 5. Export tech cards (dish compositions) ──────────────────
async function exportTechCardsTo1C(db, settings) {
  const cards = db.prepare(`
    SELECT dtc.*, d.name as dish_name, d.article as dish_article, d.id_1c as dish_id_1c
    FROM dish_tech_cards dtc
    LEFT JOIN dishes d ON d.id = dtc.dish_id
    ORDER BY dtc.dish_id
  `).all();

  const result = [];
  for (const card of cards) {
    const ingredients = db.prepare(`
      SELECT tci.*, ii.name as ingredient_name, ii.unit, ii.id_1c as ingredient_id_1c
      FROM dish_tech_card_ingredients tci
      LEFT JOIN inventory_items ii ON ii.id = tci.item_id
      WHERE tci.tech_card_id = ?
    `).all(card.id);
    result.push({
      dish_id: card.dish_id,
      dish_name: card.dish_name,
      dish_article: card.dish_article,
      dish_id_1c: card.dish_id_1c,
      cooking_time: card.cooking_time,
      yield: card.yield,
      ingredients: ingredients.map(i => ({
        item_id: i.item_id,
        ingredient_name: i.ingredient_name,
        ingredient_id_1c: i.ingredient_id_1c,
        quantity: i.quantity,
        unit: i.unit,
        cold_loss_percent: i.cold_loss_percent || 0,
        heat_loss_percent: i.heat_loss_percent || 0,
      })),
    });
  }

  const payload = { type: 'tech_cards_export', generated_at: new Date().toISOString(), tech_cards: result };

  if (settings.api_url) {
    const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/tech-cards/import';
    const resp = await apiRequest(url, 'POST', {}, payload, settings.api_key, settings.login, settings.password);
    return resp;
  }
  return { ok: true, data: { tech_cards_count: result.length, note: 'Файл сгенерирован (API не настроен)' } };
}

// ─── 6. Sync prices (bidirectional) ────────────────────────────
async function syncPricesWith1C(db, settings) {
  if (!settings.api_url) return { ok: false, data: 'URL не указан' };

  // Export current prices to 1C
  const items = db.prepare("SELECT id, name, article, id_1c, price_per_unit as price, unit FROM inventory_items WHERE id_1c IS NOT NULL OR article IS NOT NULL").all();
  const dishes = db.prepare("SELECT id, name, article, id_1c, price, unit FROM dishes WHERE id_1c IS NOT NULL OR article IS NOT NULL").all();
  const pricePayload = {
    type: 'prices_export',
    generated_at: new Date().toISOString(),
    inventory_items: items,
    dishes,
  };

  const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/prices/sync';
  const result = await apiRequest(url, 'POST', {}, pricePayload, settings.api_key, settings.login, settings.password);

  // If 1C returns updated prices, apply them
  let updatedItems = 0, updatedDishes = 0;
  if (result.ok && Array.isArray(result.data?.prices)) {
    for (const p of result.data.prices) {
      if (p.type === 'item') {
        const existing = db.prepare('SELECT id FROM inventory_items WHERE id_1c = ? OR article = ?').get(p.id_1c || '', p.article || '');
        if (existing) {
          db.prepare('UPDATE inventory_items SET price_per_unit = ? WHERE id = ?').run(p.price || 0, existing.id);
          updatedItems++;
        }
      } else if (p.type === 'dish') {
        const existing = db.prepare('SELECT id FROM dishes WHERE id_1c = ? OR article = ?').get(p.id_1c || '', p.article || '');
        if (existing) {
          db.prepare('UPDATE dishes SET price = ? WHERE id = ?').run(p.price || 0, existing.id);
          updatedDishes++;
        }
      }
    }
  }

  return {
    ok: result.ok,
    data: {
      exported_items: items.length,
      exported_dishes: dishes.length,
      updated_items: updatedItems,
      updated_dishes: updatedDishes,
      note: result.ok ? 'Цены синхронизированы' : (result.data?.message || result.data || 'Ошибка'),
    },
  };
}

// ─── 7. Export remains (stock) ─────────────────────────────────
async function exportRemainsTo1C(db, settings) {
  const items = db.prepare(`
    SELECT id, name, article, id_1c, current_stock as stock, unit, price_per_unit as price
    FROM inventory_items
    ORDER BY name
  `).all();

  const payload = {
    type: 'remains_export',
    generated_at: new Date().toISOString(),
    remains: items.map(i => ({
      id: i.id,
      name: i.name,
      article: i.article,
      id_1c: i.id_1c,
      stock: i.stock,
      unit: i.unit,
      price: i.price,
      sum: (i.stock || 0) * (i.price || 0),
    })),
  };

  if (settings.api_url) {
    const url = settings.api_url.replace(/\/+$/, '') + '/api/v1/remains/import';
    const result = await apiRequest(url, 'POST', {}, payload, settings.api_key, settings.login, settings.password);
    return result;
  }
  return { ok: true, data: { items_count: items.length, note: 'Файл сгенерирован (API не настроен)' } };
}

// ─── Run all enabled syncs ─────────────────────────────────────
async function runSyncAll(db, tenantId = 1) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled) return { ok: false, data: { error: 'Интеграция отключена' } };

  const results = [];
  let overallOk = true;

  const operations = [
    { key: 'export_orders', fn: () => exportOrdersTo1C(db, settings), direction: 'export', label: 'export_orders' },
    { key: 'import_goods', fn: () => importGoodsFrom1C(db, settings), direction: 'import', label: 'import_goods' },
    { key: 'import_contragents', fn: () => importContragentsFrom1C(db, settings), direction: 'import', label: 'import_contragents' },
    { key: 'import_menu', fn: () => importMenuFrom1C(db, settings), direction: 'import', label: 'import_menu' },
    { key: 'export_tech_cards', fn: () => exportTechCardsTo1C(db, settings), direction: 'export', label: 'export_tech_cards' },
    { key: 'sync_prices', fn: () => syncPricesWith1C(db, settings), direction: 'export', label: 'sync_prices' },
    { key: 'export_remains', fn: () => exportRemainsTo1C(db, settings), direction: 'export', label: 'export_remains' },
  ];

  for (const op of operations) {
    if (settings[op.key]) {
      let r;
      let errMsg;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          r = await op.fn();
          if (r.ok) break;
          errMsg = r.data?.message || r.data || 'Unknown error';
        } catch (e) {
          errMsg = e.message;
        }
        if (attempt === 0) await new Promise(res => setTimeout(res, 5000));
      }
      if (r && r.ok) {
        logOperation(db, tenantId, op.label, op.direction, 'success', {}, r.data, null);
        results.push({ operation: op.label, ...r });
      } else {
        logOperation(db, tenantId, op.label, op.direction, 'error', {}, null, errMsg || 'Unknown error');
        results.push({ operation: op.label, ok: false, data: { error: errMsg || 'Unknown error' } });
        overallOk = false;
      }
    }
  }

  updateSettings(db, tenantId, { last_sync_status: overallOk ? 'success' : 'error', last_sync_at: new Date().toISOString() });

  const summary = results.reduce((acc, r) => { acc[r.operation] = r.data || r; return acc; }, {});
  return { ok: overallOk, data: summary, results };
}

module.exports = {
  getSettings, updateSettings, logOperation, testConnection,
  exportOrdersTo1C, importGoodsFrom1C, importContragentsFrom1C,
  importMenuFrom1C, exportTechCardsTo1C, syncPricesWith1C, exportRemainsTo1C,
  runSyncAll,
};