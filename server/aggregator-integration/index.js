const crypto = require('crypto');

const PROVIDERS = {
  yandex: require('./providers/yandex'),
  delivery_club: require('./providers/delivery-club'),
  sbermarket: require('./providers/sbermarket'),
};

const PROVIDER_NAMES = {
  yandex: 'Яндекс Еда',
  delivery_club: 'Delivery Club',
  sbermarket: 'СберМаркет',
};

const PROVIDER_LOGOS = {
  yandex: '🔴',
  delivery_club: '🟢',
  sbermarket: '🟡',
};

function hashCredentials(credentials) {
  return crypto.createHash('sha256').update(JSON.stringify(credentials)).digest('hex');
}

function areCredentialsUnchanged(savedCredentials, currentInput) {
  const savedHash = savedCredentials?.checked_credentials_hash;
  if (!savedHash) return false;
  return savedHash === hashCredentials(currentInput);
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS aggregator_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      provider TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      credentials TEXT DEFAULT '{}',
      last_sync_at TEXT,
      last_menu_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_settings_provider
    ON aggregator_settings(tenant_id, provider)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS aggregator_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      provider TEXT NOT NULL,
      operation TEXT NOT NULL,
      request TEXT,
      response TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agg_log_provider
    ON aggregator_sync_log(provider, created_at)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS aggregator_status_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      provider TEXT NOT NULL,
      external_order_id TEXT NOT NULL,
      internal_status TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agg_status_queue
    ON aggregator_status_queue(provider, external_order_id, attempts)
  `);

  try { db.exec(`ALTER TABLE orders ADD COLUMN external_order_id TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN external_provider TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'internal'`); } catch (e) {}
  try { db.exec(`ALTER TABLE order_item_statuses ADD COLUMN external_item_id TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE aggregator_settings ADD COLUMN last_checked TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE aggregator_settings ADD COLUMN checked_credentials_hash TEXT`); } catch (e) {}

  for (const key of Object.keys(PROVIDERS)) {
    const existing = db.prepare('SELECT id FROM aggregator_settings WHERE provider = ?').get(key);
    if (!existing) {
      db.prepare(`
        INSERT INTO aggregator_settings (tenant_id, provider, enabled, credentials)
        VALUES (1, ?, 0, '{}')
      `).run(key);
    }
  }
}

function logOperation(db, tenantId, provider, operation, request, response, status, errorMessage) {
  db.prepare(`
    INSERT INTO aggregator_sync_log (tenant_id, provider, operation, request, response, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId || 1,
    provider,
    operation,
    typeof request === 'string' ? request : JSON.stringify(request || {}),
    typeof response === 'string' ? response : JSON.stringify(response || {}),
    status,
    errorMessage || null
  );
}

function setupRoutes(app, db, broadcast, io) {
  const getSettings = (req) => {
    const tenantId = req.tenant_id || 1;
    const provider = req.params.provider;
    const row = db.prepare('SELECT * FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
    return row || { tenant_id: tenantId, provider, enabled: 0, credentials: '{}', last_sync_at: null, last_menu_sync_at: null };
  };

  const updateSettings = (req) => {
    const tenantId = req.body.tenant_id || 1;
    const provider = req.params.provider;
    const existing = db.prepare('SELECT id FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
    const credentials = req.body.credentials ? JSON.stringify(req.body.credentials) : undefined;
    const enabled = req.body.enabled !== undefined ? (req.body.enabled ? 1 : 0) : undefined;

    const sets = ["updated_at = datetime('now')"];
    const vals = [];
    if (credentials !== undefined) { sets.push('credentials = ?'); vals.push(credentials); }
    if (enabled !== undefined) { sets.push('enabled = ?'); vals.push(enabled); }

    if (existing) {
      vals.push(existing.id);
      db.prepare(`UPDATE aggregator_settings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    } else {
      db.prepare(`
        INSERT INTO aggregator_settings (tenant_id, provider, enabled, credentials)
        VALUES (?, ?, ?, ?)
      `).run(tenantId, provider, enabled !== undefined ? enabled : 0, credentials || '{}');
    }
  };

  // GET /api/admin/integrations/aggregators - list all providers with settings
  app.get('/api/admin/integrations/aggregators', (req, res) => {
    try {
      const tenantId = req.tenant_id || 1;
      const rows = db.prepare('SELECT * FROM aggregator_settings WHERE tenant_id = ?').all(tenantId);

      const result = Object.keys(PROVIDERS).map(key => {
        const row = rows.find(r => r.provider === key);
        return {
          provider: key,
          name: PROVIDER_NAMES[key] || key,
          logo: PROVIDER_LOGOS[key] || '📦',
          enabled: row ? !!row.enabled : false,
          credentials: row ? (() => { try { return JSON.parse(row.credentials); } catch { return {}; } })() : {},
          lastSyncAt: row?.last_sync_at || null,
          lastMenuSyncAt: row?.last_menu_sync_at || null,
          lastChecked: row?.last_checked || null,
          checkedCredentialsHash: row?.checked_credentials_hash || null,
          createdAt: row?.created_at || null,
          updatedAt: row?.updated_at || null,
        };
      });

      res.json(result);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // GET /api/admin/integrations/aggregators/:provider - get single provider settings
  app.get('/api/admin/integrations/aggregators/:provider', (req, res) => {
    try {
      const row = getSettings(req);
      const credentials = (() => { try { return JSON.parse(row.credentials || '{}'); } catch { return {}; } })();
      res.json({ ...row, credentials });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // PUT /api/admin/integrations/aggregators/:provider - update provider settings
  app.put('/api/admin/integrations/aggregators/:provider', (req, res) => {
    try {
      const provider = req.params.provider;
      if (!PROVIDERS[provider]) return res.status(400).json({ error: `Провайдер "${provider}" не поддерживается` });

      // Strict verification: if credentials are being changed, force enable=false and clear verification
      if (req.body.credentials) {
        const tenantId = req.body.tenant_id || 1;
        const existing = db.prepare('SELECT * FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
        const existingCreds = existing ? (() => { try { return JSON.parse(existing.credentials); } catch { return {}; } })() : {};

        const changed = Object.keys(req.body.credentials).some(k => req.body.credentials[k] !== existingCreds[k]);
        if (changed && req.body.enabled) {
          return res.status(400).json({ error: 'Необходимо сначала проверить новые ключи через POST /api/admin/integrations/aggregators/:provider/test' });
        }
        if (changed) {
          req.body.enabled = false;
        }
      }

      // If trying to enable without verified credentials
      if (req.body.enabled === true) {
        const tenantId = req.body.tenant_id || 1;
        const row = db.prepare('SELECT * FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
        if (!row) {
          return res.status(400).json({ error: 'Сначала сохраните ключи' });
        }
        const credentials = req.body.credentials || (() => { try { return JSON.parse(row.credentials || '{}'); } catch { return {}; } })();
        if (!areCredentialsUnchanged(row, credentials)) {
          return res.status(400).json({ error: 'Необходимо сначала проверить ключи через POST /api/admin/integrations/aggregators/:provider/test' });
        }
      }

      updateSettings(req);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // POST /api/admin/integrations/aggregators/:provider/test - test connection
  app.post('/api/admin/integrations/aggregators/:provider/test', async (req, res) => {
    try {
      const provider = req.params.provider;
      const p = PROVIDERS[provider];
      if (!p) return res.status(400).json({ error: `Провайдер "${provider}" не поддерживается` });

      // Use credentials from request body if provided, otherwise from DB
      const credentials = req.body.credentials || (() => {
        const row = getSettings(req);
        try { return JSON.parse(row.credentials || '{}'); } catch { return {}; }
      })();

      const result = await p.testConnection(credentials);
      const status = result.ok ? 'success' : 'error';
      logOperation(db, req.body.tenant_id || 1, provider, 'test_connection', JSON.stringify({ provider, credentialsKeys: Object.keys(credentials) }), JSON.stringify(result.data), status, result.ok ? null : (result.data?.message || result.data));

      if (result.ok) {
        const tenantId = req.body.tenant_id || 1;
        const credHash = hashCredentials(credentials);
        // Also save/update the credentials in DB if they were passed in the body
        if (req.body.credentials) {
          const existing = db.prepare('SELECT id FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
          if (existing) {
            db.prepare("UPDATE aggregator_settings SET credentials = ?, last_checked = datetime('now'), checked_credentials_hash = ?, enabled = 0, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(credentials), credHash, existing.id);
          } else {
            db.prepare("INSERT INTO aggregator_settings (tenant_id, provider, enabled, credentials, last_checked, checked_credentials_hash) VALUES (?, ?, 0, ?, datetime('now'), ?)").run(tenantId, provider, JSON.stringify(credentials), credHash);
          }
        } else {
          db.prepare("UPDATE aggregator_settings SET last_checked = datetime('now'), checked_credentials_hash = ?, updated_at = datetime('now') WHERE tenant_id = ? AND provider = ?").run(credHash, tenantId, provider);
        }
      }

      res.json({ ok: result.ok, status: result.status, data: result.data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // POST /api/admin/integrations/aggregators/:provider/sync-menu - sync menu to aggregator
  app.post('/api/admin/integrations/aggregators/:provider/sync-menu', async (req, res) => {
    try {
      const provider = req.params.provider;
      const p = PROVIDERS[provider];
      if (!p) return res.status(400).json({ error: `Провайдер "${provider}" не поддерживается` });

      const tenantId = req.body.tenant_id || 1;
      const row = getSettings(req);
      const credentials = (() => { try { return JSON.parse(row.credentials || '{}'); } catch { return {}; } })();

      const result = await p.syncMenu(tenantId, credentials, db);
      const status = result.ok ? 'success' : 'error';
      logOperation(db, tenantId, provider, 'menu_sync', 'POST /menu', result.data, status, result.ok ? null : (result.data?.message || JSON.stringify(result.data)));

      if (result.ok) {
        db.prepare('UPDATE aggregator_settings SET last_menu_sync_at = datetime(\'now\'), last_sync_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE tenant_id = ? AND provider = ?').run(tenantId, provider);
      }

      res.json({ ok: result.ok, status: result.status, data: result.data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // POST /api/admin/integrations/aggregators/:provider/sync-statuses - sync pending order statuses
  app.post('/api/admin/integrations/aggregators/:provider/sync-statuses', async (req, res) => {
    try {
      const provider = req.params.provider;
      const p = PROVIDERS[provider];
      if (!p) return res.status(400).json({ error: `Провайдер "${provider}" не поддерживается` });

      const tenantId = req.body.tenant_id || 1;
      const row = getSettings(req);
      const credentials = (() => { try { return JSON.parse(row.credentials || '{}'); } catch { return {}; } })();

      const pendingOrders = db.prepare(`
        SELECT * FROM orders
        WHERE external_provider = ? AND source = 'external'
        AND status IN ('confirmed', 'preparing', 'ready', 'assigned', 'en_route')
        ORDER BY updated_at DESC
      `).all(provider);

      const results = [];
      for (const order of pendingOrders) {
        const result = await p.updateStatus(order, order.external_order_id, order.status, credentials);
        const logStatus = result.ok ? 'success' : 'error';
        logOperation(db, tenantId, provider, 'status_update', `PUT /orders/${order.external_order_id}/status -> ${order.status}`, result.data, logStatus, result.ok ? null : (result.data?.message || JSON.stringify(result.data)));
        results.push({ orderId: order.id, externalOrderId: order.external_order_id, ok: result.ok });
      }

      res.json({ ok: true, synced: results.length, results });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // GET /api/admin/integrations/aggregators/:provider/logs - get sync logs
  app.get('/api/admin/integrations/aggregators/:provider/logs', (req, res) => {
    try {
      const provider = req.params.provider;
      const tenantId = req.tenant_id || 1;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const operation = req.query.operation;
      const status = req.query.status;

      let sql = 'SELECT * FROM aggregator_sync_log WHERE tenant_id = ? AND provider = ?';
      const params = [tenantId, provider];

      if (operation) { sql += ' AND operation = ?'; params.push(operation); }
      if (status) { sql += ' AND status = ?'; params.push(status); }

      const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params)?.total || 0;
      const rows = db.prepare(sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page - 1) * limit);

      res.json({ items: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // POST /api/webhooks/aggregator - universal webhook endpoint
  app.post('/api/webhooks/aggregator', async (req, res) => {
    try {
      const provider = req.headers['x-provider'] || req.headers['x-aggregator'] || req.body?.provider || '';
      const p = PROVIDERS[provider];
      if (!p) return res.status(400).json({ error: `Провайдер "${provider}" не поддерживается` });

      const tenantId = req.headers['x-tenant-id'] || 1;
      const settings = db.prepare('SELECT * FROM aggregator_settings WHERE tenant_id = ? AND provider = ? AND enabled = 1').get(tenantId, provider);
      if (!settings) return res.status(403).json({ error: 'Интеграция не активна' });

      const credentials = (() => { try { return JSON.parse(settings.credentials || '{}'); } catch { return {}; } })();
      const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'] || '';
      if (p.verifyWebhook) {
        const rawBody = req.rawBody || JSON.stringify(req.body);
        if (!p.verifyWebhook(rawBody, signature, credentials)) {
          logOperation(db, tenantId, provider, 'webhook_signature_failed', JSON.stringify(req.body), '', 'error', 'Invalid signature');
          return res.status(401).json({ error: 'Неверная подпись' });
        }
      }

      const eventType = req.body?.event || req.body?.type || '';
      logOperation(db, tenantId, provider, 'webhook_received', JSON.stringify(req.body), '', 'success', null);

      if (eventType === 'order' || eventType === 'order:new' || req.body?.order) {
        const parsed = p.parseOrder(req.body);
        const existing = db.prepare('SELECT id FROM orders WHERE external_order_id = ? AND external_provider = ?').get(parsed.externalOrderId, provider);
        if (existing) {
          logOperation(db, tenantId, provider, 'webhook_duplicate', JSON.stringify({ externalOrderId: parsed.externalOrderId }), JSON.stringify({ orderId: existing.id }), 'success', null);
          return res.status(200).json({ ok: true, orderId: existing.id, duplicate: true });
        }
        const itemsJson = JSON.stringify(parsed.items.map(i => ({
          dishId: 0,
          externalItemId: i.externalItemId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          options: i.options,
          itemStatus: 'pending',
        })));

        const info = db.prepare(`
          INSERT INTO orders (
            user_id, user_name, user_phone, address, items, subtotal,
            delivery_fee, total, payment_method, is_paid, type, status,
            external_order_id, external_provider, source, comment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          0, parsed.userName, parsed.userPhone, parsed.address || '', itemsJson,
          parsed.subtotal || parsed.total, parsed.deliveryFee || 0, parsed.total,
          parsed.paymentMethod || 'online', 0, parsed.type || 'delivery', 'new',
          parsed.externalOrderId, provider, 'external', parsed.comment || ''
        );

        const orderId = Number(info.lastInsertRowid);
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'new', `Внешний заказ (${PROVIDER_NAMES[provider] || provider})`);

        for (const item of parsed.items) {
          db.prepare('INSERT INTO order_item_statuses (order_id, dish_id, status, external_item_id) VALUES (?, ?, ?, ?)').run(orderId, 0, 'pending', item.externalItemId || '');
        }

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        if (io) io.emit('order:new', order);
        if (broadcast) broadcast({ type: 'order:new', orderId, external: true, provider });

        logOperation(db, tenantId, provider, 'order_receive', JSON.stringify({ externalOrderId: parsed.externalOrderId }), JSON.stringify({ orderId }), 'success', null);

        return res.status(201).json({ ok: true, orderId, externalOrderId: parsed.externalOrderId });
      }

      if (eventType === 'status' || eventType === 'order:status' || req.body?.status) {
        const externalOrderId = req.body?.order_id || req.body?.orderId || '';
        const externalStatus = req.body?.status || '';
        const internalStatus = p.mapStatusFromExternal ? p.mapStatusFromExternal(externalStatus) : null;

        if (externalOrderId && internalStatus) {
          const order = db.prepare('SELECT * FROM orders WHERE external_order_id = ? AND external_provider = ?').get(externalOrderId, provider);
          if (order) {
            db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(internalStatus, order.id);
            db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(order.id, internalStatus, `Статус обновлён из ${PROVIDER_NAMES[provider] || provider}`);
            if (io) io.emit('order:update', order);
            if (broadcast) broadcast({ type: 'order:update', orderId: order.id, status: internalStatus });
            logOperation(db, tenantId, provider, 'status_receive', JSON.stringify({ externalOrderId, externalStatus }), JSON.stringify({ orderId: order.id, internalStatus }), 'success', null);
          }
        }

        return res.json({ ok: true });
      }

      res.json({ ok: true, event: eventType || 'unknown' });
    } catch (e) {
      console.error('WEBHOOK_ERROR:', e.message);
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // Hook into order status changes to auto-sync to aggregators
  function scheduleStatusUpdate(db, tenantId, provider, externalOrderId, internalStatus, errorMessage) {
    const existing = db.prepare('SELECT id FROM aggregator_status_queue WHERE provider = ? AND external_order_id = ? AND internal_status = ?').get(provider, externalOrderId, internalStatus);
    if (existing) {
      db.prepare('UPDATE aggregator_status_queue SET attempts = attempts + 1, last_error = ?, updated_at = datetime(\'now\') WHERE id = ?').run(errorMessage || null, existing.id);
    } else {
      db.prepare('INSERT INTO aggregator_status_queue (tenant_id, provider, external_order_id, internal_status, last_error) VALUES (?, ?, ?, ?, ?)').run(tenantId, provider, externalOrderId, internalStatus, errorMessage || null);
    }
  }

  async function processStatusQueue(provider) {
    const p = PROVIDERS[provider];
    if (!p) return { processed: 0 };
    const pending = db.prepare('SELECT * FROM aggregator_status_queue WHERE provider = ? AND attempts < 5 ORDER BY created_at ASC LIMIT 20').all(provider);
    let processed = 0;
    for (const q of pending) {
      const settings = db.prepare('SELECT * FROM aggregator_settings WHERE provider = ? AND enabled = 1').get(provider);
      if (!settings) continue;
      const credentials = (() => { try { return JSON.parse(settings.credentials || '{}'); } catch { return {}; } })();
      const order = db.prepare('SELECT * FROM orders WHERE external_order_id = ? AND external_provider = ?').get(q.external_order_id, provider);
      if (!order) continue;
      try {
        const result = await p.updateStatus(order, q.external_order_id, q.internal_status, credentials);
        if (result.ok) {
          db.prepare('DELETE FROM aggregator_status_queue WHERE id = ?').run(q.id);
          logOperation(db, settings.tenant_id || 1, provider, 'status_update_retry', `PUT /orders/${q.external_order_id}/status -> ${q.internal_status}`, JSON.stringify(result.data), 'success', null);
          processed++;
        } else {
          scheduleStatusUpdate(db, settings.tenant_id || 1, provider, q.external_order_id, q.internal_status, JSON.stringify(result.data));
        }
      } catch (e) {
        scheduleStatusUpdate(db, settings.tenant_id || 1, provider, q.external_order_id, q.internal_status, e.message);
      }
    }
    return { processed };
  }

  app.onOrderStatusChange = (orderId, status) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order || order.source !== 'external' || !order.external_provider || !order.external_order_id) return;

      const provider = order.external_provider;
      const p = PROVIDERS[provider];
      if (!p) return;

      const settings = db.prepare('SELECT * FROM aggregator_settings WHERE provider = ? AND enabled = 1').get(provider);
      if (!settings) return;

      const credentials = (() => { try { return JSON.parse(settings.credentials || '{}'); } catch { return {}; } })();

      p.updateStatus(order, order.external_order_id, status, credentials)
        .then(result => {
          const logStatus = result.ok ? 'success' : 'error';
          logOperation(db, settings.tenant_id || 1, provider, 'status_update', `PUT /orders/${order.external_order_id}/status -> ${status}`, result.data, logStatus, result.ok ? null : (result.data?.message || JSON.stringify(result.data)));
          if (!result.ok) scheduleStatusUpdate(db, settings.tenant_id || 1, provider, order.external_order_id, status, JSON.stringify(result.data));
        })
        .catch(err => {
          logOperation(db, settings.tenant_id || 1, provider, 'status_update', `PUT /orders/${order.external_order_id}/status -> ${status}`, '', 'error', err.message);
          scheduleStatusUpdate(db, settings.tenant_id || 1, provider, order.external_order_id, status, err.message);
        });
    } catch (e) {
      console.error('AUTO_SYNC_STATUS_ERROR:', e.message);
    }
  };

  // Retry endpoint
  app.post('/api/admin/integrations/aggregators/:provider/retry', async (req, res) => {
    try {
      const provider = req.params.provider;
      if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Провайдер не поддерживается' });
      const result = await processStatusQueue(provider);
      res.json(result);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });
}

module.exports = { initTables, setupRoutes, PROVIDERS, PROVIDER_NAMES };
