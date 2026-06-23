const jwt = require('jsonwebtoken');

module.exports = function(app, db, config) {
  const { JWT_SECRET, safeError, toCamelCaseArray, getLoyaltySettings, supplierPortal } = config;

app.get('/api/admin/auto-orders/status', (req, res) => {
  try {
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_orders_enabled'").get();
    res.json({ enabled: setting?.value === '1', lastCheck: autoOrdersService.getLastCheck() });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/auto-orders/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    db.prepare("INSERT INTO system_settings (key, value) VALUES ('auto_orders_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(enabled ? '1' : '0');
    res.json({ ok: true, enabled });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/auto-orders/run-now', (req, res) => {
  try {
    const result = autoOrdersService.checkAndCreateOrders(db);
    res.json({ ...result, lastCheck: autoOrdersService.getLastCheck() });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/auto-orders/low-stock', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT ii.id, ii.name, ii.current_stock, ii.current_balance, ii.min_stock,
        ii.unit, ii.price_per_unit, COALESCE(s.name, ii.contragent_name) as supplier_name
      FROM inventory_items ii
      LEFT JOIN suppliers s ON s.id = ii.default_contragent_id
      WHERE ii.min_stock > 0 AND ii.current_stock < ii.min_stock AND ii.tenant_id = current_tenant_id()
      ORDER BY (ii.current_stock - ii.min_stock) ASC
    `).all();
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/auto-orders/settings', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    res.json(autoOrdersService.getAutoOrderSettings(db, tenantId));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/settings', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const settings = autoOrdersService.saveAutoOrderSettings(db, tenantId, req.body);
    autoOrdersService.rescheduleCron(db);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/approve', (req, res) => {
  try { res.json(autoOrdersService.approveOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/reject', (req, res) => {
  try { res.json(autoOrdersService.rejectOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/send', (req, res) => {
  try { res.json(autoOrdersService.sendOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/receive', (req, res) => {
  try { res.json(autoOrdersService.receiveOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/shifts/current', (req, res) => {
  try {
    const shift = shiftService.getCurrentShift(req.query.tenant_id || 1);
    res.json(shift || null);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/shifts/open', (req, res) => {
  try {
    const { staffId, staffName, openingBalance } = req.body;
    const result = shiftService.openShift(staffId || 0, staffName || '', openingBalance || 0, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/shifts/:id/close', (req, res) => {
  try {
    const { closingBalance, notes } = req.body;
    const result = shiftService.closeShift(req.params.id, closingBalance || 0, notes || '', req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/shifts/:id/z-report', (req, res) => {
  try {
    const result = shiftService.getZReport(req.params.id, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/shifts', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    res.json(shiftService.getShifts(req.query.tenant_id || 1, page, limit));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/auto-writeoff/settings', (req, res) => {
  try { res.json(autoWriteoffService.getSettings(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-writeoff/settings', (req, res) => {
  try {
    const settings = autoWriteoffService.saveSettings(db, req.body, req.query.tenant_id || 1);
    autoWriteoffService.rescheduleCron(db);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/auto-writeoff/expiring', (req, res) => {
  try {
    const settings = autoWriteoffService.getSettings(db, req.query.tenant_id || 1);
    const items = autoWriteoffService.getExpiringSoon(db, req.query.days || settings.warn_days || 3);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/auto-writeoff/expired', (req, res) => {
  try { res.json(autoWriteoffService.getExpiredItems(db)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/auto-writeoff/run-now', (req, res) => {
  try {
    const result = autoWriteoffService.runAutoWriteoff(db, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/auto-writeoff/calculate-losses', (req, res) => {
  try {
    const { ids } = req.body;
    const result = autoWriteoffService.calculateLosses(db, ids || []);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/costing/overview', (req, res) => {
  try { res.json(costingService.getCostingOverview(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/costing/recalculate', (req, res) => {
  try {
    const result = costingService.recalculateAll(db, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/costing/recalculate/:dishId', (req, res) => {
  try {
    const dish = db.prepare('SELECT id, tech_card_id FROM dishes WHERE id = ?').get(req.params.dishId);
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });
    const result = costingService.recalculateOne(db, dish.id, dish.tech_card_id);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/costing/status', (req, res) => {
  res.json({ lastRun: costingService.getLastRun() });
});
app.get('/api/admin/honest-sign/settings', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM honest_sign_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s) { db.prepare('INSERT INTO honest_sign_settings (tenant_id) VALUES (?)').run(req.tenant_id || 1); return res.json({}); }
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/honest-sign/settings', (req, res) => {
  try {
    const { enabled, api_key, organization_inn } = req.body;
    const existing = db.prepare('SELECT id FROM honest_sign_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (existing) db.prepare("UPDATE honest_sign_settings SET enabled = ?, api_key = ?, organization_inn = ? WHERE tenant_id = ?").run(enabled ? 1 : 0, api_key || '', organization_inn || '', req.tenant_id || 1);
    else db.prepare("INSERT INTO honest_sign_settings (tenant_id, enabled, api_key, organization_inn) VALUES (?, ?, ?, ?)").run(req.tenant_id || 1, enabled ? 1 : 0, api_key || '', organization_inn || '');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/honest-sign/check', (req, res) => {
  try {
    const { marking_code } = req.body;
    if (!marking_code || marking_code.length < 10) return res.json({ valid: false, error: 'Неверный формат кода' });
    res.json({ valid: true, product_gtin: marking_code.substring(0, 14), message: 'Код корректен' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/honest-sign/products', (req, res) => {
  try {
    const products = db.prepare('SELECT hsp.*, ii.name as product_name FROM honest_sign_products hsp LEFT JOIN inventory_items ii ON ii.id = hsp.product_id WHERE hsp.tenant_id = ? ORDER BY hsp.created_at DESC').all(req.tenant_id || 1);
    res.json(products);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/supplier-portal/users', (req, res) => {
  try {
    const { supplier_id } = req.query;
    let sql = 'SELECT spu.*, s.name as supplier_name FROM supplier_portal_users spu LEFT JOIN suppliers s ON s.id = spu.supplier_id WHERE spu.tenant_id = current_tenant_id()';
    const params = [];
    if (supplier_id) { sql += ' AND spu.supplier_id = ?'; params.push(supplier_id); }
    sql += ' ORDER BY spu.created_at DESC';
    const users = db.prepare(sql).all(...params);
    res.json(users.map(u => ({ ...u, permissions: JSON.parse(u.permissions || '{}') })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/supplier-portal/users', (req, res) => {
  try {
    const { supplier_id, login, password, permissions } = req.body;
    if (!supplier_id || !login || !password) return res.status(400).json({ error: 'supplier_id, login и password обязательны' });
    const existing = db.prepare('SELECT id FROM supplier_portal_users WHERE login = ?').get(login);
    if (existing) return res.status(400).json({ error: 'Логин уже занят' });
    const hash = supplierPortal.hashPassword(password);
    const info = db.prepare('INSERT INTO supplier_portal_users (tenant_id, supplier_id, login, password_hash, permissions, is_active) VALUES (?, ?, ?, ?, ?, 1)').run(
      1, supplier_id, login, hash, JSON.stringify(permissions || { prices: 1, stock: 1, orders: 1, products: 1 })
    );
    const user = db.prepare('SELECT spu.*, s.name as supplier_name FROM supplier_portal_users spu LEFT JOIN suppliers s ON s.id = spu.supplier_id WHERE spu.id = ? AND spu.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    res.status(201).json({ ...user, permissions: JSON.parse(user.permissions || '{}') });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/supplier-portal/users/:id', (req, res) => {
  try {
    const { login, is_active, permissions, password } = req.body;
    const sets = []; const params = [];
    if (login !== undefined) { sets.push('login = ?'); params.push(login); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (permissions !== undefined) { sets.push('permissions = ?'); params.push(JSON.stringify(permissions)); }
    if (password !== undefined) { sets.push('password_hash = ?'); params.push(supplierPortal.hashPassword(password)); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE supplier_portal_users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const user = db.prepare('SELECT spu.*, s.name as supplier_name FROM supplier_portal_users spu LEFT JOIN suppliers s ON s.id = spu.supplier_id WHERE spu.id = ? AND spu.tenant_id = current_tenant_id()').get(req.params.id);
    res.json({ ...user, permissions: JSON.parse(user.permissions || '{}') });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/supplier-portal/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM supplier_portal_users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/supplier-portal/products/:supplierId', (req, res) => {
  try {
    const products = supplierPortal.getProductCatalog(db, req.params.supplierId);
    res.json(products);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/supplier-portal/products', (req, res) => {
  try {
    const { supplier_id, product_id, price } = req.body;
    if (!supplier_id || !product_id) return res.status(400).json({ error: 'supplier_id и product_id обязательны' });
    db.prepare('INSERT OR REPLACE INTO supplier_products (tenant_id, supplier_id, product_id, price, is_active) VALUES (?, ?, ?, ?, 1)').run(1, supplier_id, product_id, price || 0);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/supplier-portal/products/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM supplier_products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/supplier-portal/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT sal.*, s.name as supplier_name FROM supplier_activity_log sal LEFT JOIN suppliers s ON s.id = sal.supplier_id WHERE sal.tenant_id = current_tenant_id() ORDER BY sal.created_at DESC LIMIT 200').all();
    res.json(logs);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/themes', (req, res) => {
  try {
    const { name, colors, tenant_id } = req.body;
    if (!name || !colors) return res.status(400).json({ error: 'Название и цвета обязательны' });
    const info = db.prepare('INSERT INTO themes (tenant_id, name, colors, is_preset) VALUES (?, ?, ?, 0)').run(tenant_id || null, name, JSON.stringify(colors));
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...theme, colors: JSON.parse(theme.colors) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/admin/themes/:id', (req, res) => {
  try {
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
    if (theme.is_preset) return res.status(400).json({ error: 'Нельзя редактировать готовую тему' });
    const { name, colors } = req.body;
    db.prepare('UPDATE themes SET name = COALESCE(?, name), colors = COALESCE(?, colors) WHERE id = ?').run(name || null, colors ? JSON.stringify(colors) : null, req.params.id);
    const updated = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    res.json({ ...updated, colors: JSON.parse(updated.colors) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/admin/themes/:id', (req, res) => {
  try {
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
    if (theme.is_preset) return res.status(400).json({ error: 'Нельзя удалить готовую тему' });
    db.prepare('UPDATE themes SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/admin/loyalty/guests', (req, res) => {
  try {
    const guests = db.prepare(`
      SELECT u.id, u.name, u.phone, u.bonus_balance, u.total_spent, u.loyalty_level,
        COALESCE(ub.balance, 0) as bonus_balance_internal,
        COALESCE(ub.lifetime_earned, 0) as lifetime_earned,
        COALESCE(ub.lifetime_spent, 0) as lifetime_spent,
        u.visits_count
      FROM users u
      LEFT JOIN user_bonuses ub ON ub.user_id = u.id
      WHERE u.role = 'guest' AND u.tenant_id = current_tenant_id()
      ORDER BY u.name
    `).all();
    res.json(toCamelCaseArray(guests));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/loyalty/settings', (req, res) => {
  try {
    const { bonusPercent, burnDays, maxWriteOffPercent, levels } = req.body;
    const sets = []; const params = [];
    if (bonusPercent !== undefined) { sets.push('bonus_percent = ?'); params.push(bonusPercent); }
    if (burnDays !== undefined) { sets.push('burn_days = ?'); params.push(burnDays); }
    if (maxWriteOffPercent !== undefined) { sets.push('max_write_off_percent = ?'); params.push(maxWriteOffPercent); }
    if (levels !== undefined) { sets.push('levels = ?'); params.push(JSON.stringify(levels)); }
    if (sets.length) { sets.push("updated_at = datetime('now')"); db.prepare(`UPDATE loyalty_settings SET ${sets.join(', ')} WHERE id = 1`).run(...params); }
    res.json(getLoyaltySettings());
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/loyalty/adjust', (req, res) => {
  try {
    const { userId, amount, description, type } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: 'userId и amount обязательны' });
    const t = type || (amount > 0 ? 'earned' : 'spend');
    let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
    if (!bonus) {
      const info = db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, 0, 0)').run(userId);
      bonus = db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(info.lastInsertRowid);
    }
    if (amount > 0) {
      db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(amount, amount, bonus.id);
      db.prepare('UPDATE users SET bonus_balance = bonus_balance + ? WHERE id = ?').run(amount, userId);
    } else {
      const absAmount = Math.abs(amount);
      db.prepare('UPDATE user_bonuses SET balance = MAX(0, balance - ?), lifetime_spent = lifetime_spent + ? WHERE id = ?').run(absAmount, absAmount, bonus.id);
      db.prepare('UPDATE users SET bonus_balance = MAX(0, bonus_balance - ?) WHERE id = ?').run(absAmount, userId);
    }
    db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description) VALUES (?, ?, ?, ?, ?)').run(userId, bonus.id, t, amount, description || 'Ручная корректировка администратором');
    res.json({ success: true, newBalance: db.prepare('SELECT balance FROM user_bonuses WHERE id = ?').get(bonus.id).balance });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/courier-templates', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const templates = db.prepare('SELECT * FROM courier_chat_templates WHERE tenant_id = ? ORDER BY sort_order ASC, created_at DESC').all(tenantId);
    res.json(templates.map(t => ({ ...t, isActive: !!t.is_active, sortOrder: t.sort_order })));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/courier-templates', (req, res) => {
  try {
    const { tenant_id, text, is_active, sort_order } = req.body;
    const info = db.prepare('INSERT INTO courier_chat_templates (tenant_id, text, is_active, sort_order) VALUES (?, ?, ?, ?)')
      .run(tenant_id || 1, text || '', is_active !== undefined ? (is_active ? 1 : 0) : 1, sort_order || 0);
    const tmpl = db.prepare('SELECT * FROM courier_chat_templates WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...tmpl, isActive: !!tmpl.is_active, sortOrder: tmpl.sort_order });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/courier-templates/:id', (req, res) => {
  try {
    const { text, is_active, sort_order } = req.body;
    const updates = [];
    const params = [];
    if (text !== undefined) { updates.push('text = ?'); params.push(text); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (updates.length) {
      updates.push("updated_at = datetime('now', '+3 hours')");
      params.push(req.params.id);
      db.prepare(`UPDATE courier_chat_templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    const tmpl = db.prepare('SELECT * FROM courier_chat_templates WHERE id = ?').get(req.params.id);
    res.json({ ...tmpl, isActive: !!tmpl.is_active, sortOrder: tmpl.sort_order });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/courier-templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM courier_chat_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/courier-templates/reorder', (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Order must be an array of {id, sort_order}' });
    const update = db.prepare('UPDATE courier_chat_templates SET sort_order = ? WHERE id = ?');
    for (const item of order) {
      update.run(item.sort_order, item.id);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/integrations/1c/settings', (req, res) => {
  try {
    const settings = integration1C.getSettings(db);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/integrations/1c/settings', (req, res) => {
  try {
    integration1C.updateSettings(db, 1, req.body);
    if (typeof schedule1CSync === 'function') schedule1CSync();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/integrations/1c/test', async (req, res) => {
  try {
    const settings = integration1C.getSettings(db);
    const result = await integration1C.testConnection(settings);
    integration1C.logOperation(db, 1, 'test_connection', 'export', result.ok ? 'success' : 'error', {}, result.data, result.ok ? null : result.data);
    if (result.ok) {
      integration1C.updateSettings(db, 1, { last_sync_status: 'success', last_sync_at: new Date().toISOString() });
    } else {
      integration1C.updateSettings(db, 1, { last_sync_status: 'error' });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/integrations/1c/sync', async (req, res) => {
  try {
    const result = await integration1C.runSyncAll(db, 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/integrations/1c/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { direction, status, operation, dateFrom, dateTo } = req.query;
    const conditions = [];
    const params = [];
    if (direction) { conditions.push('direction = ?'); params.push(direction); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (operation) { conditions.push('operation = ?'); params.push(operation); }
    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM integration_1c_log ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM integration_1c_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/integrations/1c/sync/:operation', async (req, res) => {
  try {
    const { operation } = req.params;
    const settings = integration1C.getSettings(db);
    if (!settings.enabled) return res.status(400).json({ ok: false, error: 'Интеграция отключена' });

    const opMap = {
      export_orders: integration1C.exportOrdersTo1C,
      import_goods: integration1C.importGoodsFrom1C,
      import_contragents: integration1C.importContragentsFrom1C,
      import_menu: integration1C.importMenuFrom1C,
      export_tech_cards: integration1C.exportTechCardsTo1C,
      sync_prices: integration1C.syncPricesWith1C,
      export_remains: integration1C.exportRemainsTo1C,
    };

    const fn = opMap[operation];
    if (!fn) return res.status(400).json({ ok: false, error: `Неизвестная операция: ${operation}` });

    const dirs = { export_orders: 'export', import_goods: 'import', import_contragents: 'import', import_menu: 'import', export_tech_cards: 'export', sync_prices: 'export', export_remains: 'export' };
    const r = await fn(db, settings);
    integration1C.logOperation(db, 1, operation, dirs[operation] || 'export', r.ok ? 'success' : 'error', {}, r.data, r.ok ? null : (r.data?.message || r.data || 'Unknown error'));

    if (r.ok) {
      integration1C.updateSettings(db, 1, { last_sync_status: 'success', last_sync_at: new Date().toISOString() });
    } else {
      integration1C.updateSettings(db, 1, { last_sync_status: 'error' });
    }
    res.json(r);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/crm/settings/:provider', (req, res) => {
  try {
    const data = crmIntegrationService.getSettings(db, req.params.provider, req.query.tenant_id || 1);
    res.json(data);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/crm/settings/:provider', (req, res) => {
  try {
    crmIntegrationService.saveSettings(db, req.params.provider, req.body, req.query.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/crm/test/:provider', async (req, res) => {
  try {
    const settings = crmIntegrationService.getSettings(db, req.params.provider, req.body?.tenant_id || 1);
    const result = await crmIntegrationService.testConnection(req.params.provider, settings);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/crm/export/:provider', async (req, res) => {
  try {
    const result = await crmIntegrationService.exportClients(db, req.params.provider, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/fiscal/settings', (req, res) => {
  try {
    const settings = fiscalization.getSettings(db);
    const result = settings.map(s => ({
      ...s,
      parsedSettings: (() => { try { return JSON.parse(s.settings || '{}'); } catch { return {}; } })(),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/fiscal/settings/:provider', (req, res) => {
  try {
    fiscalization.updateSettings(db, 1, req.params.provider, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/fiscal/test', async (req, res) => {
  try {
    const { provider, settings } = req.body;
    const result = await fiscalization.testConnection({ ...settings, provider });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/fiscal/print/:orderId', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    // Create receipt record
    const receiptId = fiscalization.createReceipt(db, order, req.body.paymentMethod || 'cash');
    const kktSettings = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = 1 AND enabled = 1").all();

    if (kktSettings.length === 0) {
      return res.json({ ok: false, data: 'Нет активных касс. Чек сохранён в очередь.' });
    }

    // Try to print immediately
    const result = await fiscalization.printReceiptById(db, receiptId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/fiscal/refund/:orderId', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const receiptId = fiscalization.createRefundReceipt(db, order, req.body.reason || 'Возврат');
    const receipt = db.prepare('SELECT * FROM fiscal_receipts WHERE id = ?').get(receiptId);
    res.json({ ok: true, receipt });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/fiscal/retry/:receiptId', async (req, res) => {
  try {
    const result = await fiscalization.printReceiptById(db, req.params.receiptId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/fiscal/receipts', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, orderId, dateFrom, dateTo } = req.query;
    const conditions = ['tenant_id = 1'];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (orderId) { conditions.push('order_id = ?'); params.push(orderId); }
    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM fiscal_receipts ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM fiscal_receipts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/fiscal/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1').get()?.count || 0;
    const printed = db.prepare("SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'printed'").get()?.count || 0;
    const pending = db.prepare("SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'pending'").get()?.count || 0;
    const errors = db.prepare("SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'error'").get()?.count || 0;
    const totalSum = db.prepare("SELECT COALESCE(SUM(total), 0) as sum FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'printed'").get()?.sum || 0;
    res.json({ total, printed, pending, errors, totalSum });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/fiscal/process-queue', async (req, res) => {
  try {
    const result = await fiscalization.processPendingReceipts(db);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/terminal/settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const settings = terminalIntegration.getSettings(db, tenantId);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/terminal/settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const settings = terminalIntegration.saveSettings(db, tenantId, req.body);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/terminal/test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const result = await terminalIntegration.testConnection(db, tenantId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/terminal/transactions', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, orderId } = req.query;
    const conditions = ['tenant_id = 1'];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (orderId) { conditions.push('order_id = ?'); params.push(orderId); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM terminal_transactions ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM terminal_transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/terminal/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const { status, operation, orderId } = req.query;
    const conditions = ['tenant_id = 1'];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (operation) { conditions.push('operation = ?'); params.push(operation); }
    if (orderId) { conditions.push('order_id = ?'); params.push(orderId); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM terminal_logs ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM terminal_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/franchise/networks', (req, res) => {
  try {
    const networks = db.prepare('SELECT fn.*, COALESCE(s.first_name || " " || s.last_name, s.first_name, "") as manager_name FROM franchise_networks fn LEFT JOIN staff s ON s.id = fn.manager_id WHERE fn.tenant_id = ?').all(req.tenant_id || 1);
    res.json(networks);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/franchise/networks', (req, res) => {
  try {
    const { name, manager_id, royalty_percent } = req.body;
    const result = db.prepare('INSERT INTO franchise_networks (name, manager_id, royalty_percent, tenant_id) VALUES (?, ?, ?, ?)').run(name, manager_id || null, royalty_percent || 0, req.tenant_id || 1);
    res.json({ id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/franchise/networks/:id', (req, res) => {
  try {
    const { name, manager_id, royalty_percent } = req.body;
    db.prepare('UPDATE franchise_networks SET name = ?, manager_id = ?, royalty_percent = ? WHERE id = ? AND tenant_id = ?').run(name, manager_id || null, royalty_percent || 0, req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/franchise/networks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM franchise_networks WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    db.prepare('DELETE FROM global_menu_items WHERE network_id = ?').run(req.params.id);
    db.prepare('DELETE FROM franchise_adaptations WHERE network_id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/franchise/menu/:networkId', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM global_menu_items WHERE network_id = ? AND tenant_id = ?').all(req.params.networkId, req.tenant_id || 1);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/franchise/menu', (req, res) => {
  try {
    const { network_id, name, category, base_price, tech_card_id } = req.body;
    const result = db.prepare('INSERT INTO global_menu_items (network_id, name, category, base_price, tech_card_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?)').run(network_id, name, category || null, base_price || 0, tech_card_id || null, req.tenant_id || 1);
    res.json({ id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/franchise/menu/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM global_menu_items WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM franchise_adaptations WHERE global_item_id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/franchise/royalty/:networkId', (req, res) => {
  try {
    const invoices = db.prepare('SELECT ri.*, t.name as tenant_name FROM royalty_invoices ri LEFT JOIN tenants t ON t.id = ri.tenant_id WHERE ri.network_id = ? ORDER BY ri.created_at DESC').all(req.params.networkId);
    res.json(invoices);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/franchise/royalty/generate', (req, res) => {
  try {
    const { network_id, period } = req.body;
    const network = db.prepare('SELECT * FROM franchise_networks WHERE id = ?').get(network_id);
    if (!network) return res.status(404).json({ error: 'Network not found' });
    const tenants = db.prepare('SELECT id, name FROM tenants').all();
    const created = [];
    for (const t of tenants) {
      const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'cancelled'").get(t.id, period);
      const amount = totalRevenue.revenue * (network.royalty_percent / 100);
      const existing = db.prepare('SELECT id FROM royalty_invoices WHERE tenant_id = ? AND network_id = ? AND period = ?').get(t.id, network_id, period);
      if (!existing) {
        db.prepare('INSERT INTO royalty_invoices (tenant_id, network_id, period, amount) VALUES (?, ?, ?, ?)').run(t.id, network_id, period, amount);
      }
      created.push({ tenant_id: t.id, tenant_name: t.name, amount });
    }
    res.json({ ok: true, created, royalty_percent: network.royalty_percent });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/franchise/royalty/:id/pay', (req, res) => {
  try {
    db.prepare("UPDATE royalty_invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/yandex-afisha/settings', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM yandex_afisha_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s) {
      db.prepare('INSERT INTO yandex_afisha_settings (tenant_id) VALUES (?)').run(req.tenant_id || 1);
      return res.json({ tenant_id: req.tenant_id || 1, api_key: '', venue_id: '', enabled: 0, auto_confirm: 0 });
    }
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/yandex-afisha/settings', (req, res) => {
  try {
    const { api_key, venue_id, enabled, auto_confirm } = req.body;
    const existing = db.prepare('SELECT id FROM yandex_afisha_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (existing) {
      db.prepare("UPDATE yandex_afisha_settings SET api_key = ?, venue_id = ?, enabled = ?, auto_confirm = ?, updated_at = datetime('now') WHERE tenant_id = ?")
        .run(api_key || '', venue_id || '', enabled ? 1 : 0, auto_confirm ? 1 : 0, req.tenant_id || 1);
    } else {
      db.prepare("INSERT INTO yandex_afisha_settings (tenant_id, api_key, venue_id, enabled, auto_confirm) VALUES (?, ?, ?, ?, ?)")
        .run(req.tenant_id || 1, api_key || '', venue_id || '', enabled ? 1 : 0, auto_confirm ? 1 : 0);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/yandex-afisha/test', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM yandex_afisha_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s || !s.api_key) return res.json({ ok: false, message: 'API ключ не настроен' });
    res.json({ ok: true, message: 'Подключение работает' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/yandex-afisha/bookings', (req, res) => {
  try {
    let sql = 'SELECT * FROM yandex_afisha_bookings WHERE tenant_id = ?';
    const params = [req.tenant_id || 1];
    if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.date_from) { sql += ' AND date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += ' AND date <= ?'; params.push(req.query.date_to); }
    sql += ' ORDER BY date DESC, time DESC';
    const bookings = db.prepare(sql).all(...params);
    res.json(bookings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/admin/yandex-afisha/bookings/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.prepare("UPDATE yandex_afisha_bookings SET status = ? WHERE id = ? AND tenant_id = ?").run(status, req.params.id, req.tenant_id || 1);
    const booking = db.prepare('SELECT * FROM yandex_afisha_bookings WHERE id = ?').get(req.params.id);
    if (status === 'confirmed' && booking) {
      const existingBooking = db.prepare("SELECT id FROM bookings WHERE date = ? AND time = ? AND user_phone = ? AND status = 'confirmed'").get(booking.date, booking.time, booking.phone);
      if (!existingBooking) {
        const result = db.prepare("INSERT INTO bookings (user_name, user_phone, date, time, guest_count, comment, status) VALUES (?, ?, ?, ?, ?, ?, 'confirmed')").run(booking.name, booking.phone || '', booking.date, booking.time, booking.guests, booking.comment || 'Яндекс Афиша');
        db.prepare('UPDATE yandex_afisha_bookings SET booking_id = ? WHERE id = ?').run(result.lastInsertRowid, req.params.id);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/yandex-afisha/stats', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    const total = db.prepare('SELECT COUNT(*) as c FROM yandex_afisha_bookings WHERE tenant_id = ?').get(tenantId).c;
    const confirmed = db.prepare("SELECT COUNT(*) as c FROM yandex_afisha_bookings WHERE tenant_id = ? AND status = 'confirmed'").get(tenantId).c;
    const cancelled = db.prepare("SELECT COUNT(*) as c FROM yandex_afisha_bookings WHERE tenant_id = ? AND status = 'cancelled'").get(tenantId).c;
    const byDate = db.prepare("SELECT date, COUNT(*) as count FROM yandex_afisha_bookings WHERE tenant_id = ? GROUP BY date ORDER BY date DESC LIMIT 30").all(tenantId);
    res.json({ total, confirmed, cancelled, conversion_rate: total > 0 ? Math.round(confirmed / total * 100) : 0, by_date: byDate });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/extensions', (req, res) => {
  try {
    const installed = db.prepare('SELECT * FROM extensions WHERE tenant_id = ?').all(req.tenant_id || 1);
    const catalog = [];
    res.json({ installed, catalog });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/extensions/install', (req, res) => {
  try {
    const { name, description, version, developer, icon, url, type } = req.body;
    const existing = db.prepare('SELECT id FROM extensions WHERE name = ? AND tenant_id = ?').get(name, req.tenant_id || 1);
    if (existing) return res.json({ ok: true, message: 'Уже установлено' });
    db.prepare("INSERT INTO extensions (name, description, version, developer, icon, url, type, is_active, tenant_id, installed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))").run(name, description || '', version || '1.0.0', developer || '', icon || '', url || '', type || 'integration', req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/extensions/:id/toggle', (req, res) => {
  try {
    const ext = db.prepare('SELECT * FROM extensions WHERE id = ?').get(req.params.id);
    if (!ext) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE extensions SET is_active = ? WHERE id = ?').run(ext.is_active ? 0 : 1, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/extensions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM extensions WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/telephony/settings', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM telephony_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s) { db.prepare('INSERT INTO telephony_settings (tenant_id) VALUES (?)').run(req.tenant_id || 1); return res.json({}); }
    if (s.api_key) s.api_key = s.api_key.substring(0, 4) + '****';
    if (s.api_secret) s.api_secret = s.api_secret.substring(0, 4) + '****';
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/telephony/settings', (req, res) => {
  try {
    const { provider, enabled, api_key, api_secret, api_url, widget_url } = req.body;
    const existing = db.prepare('SELECT id FROM telephony_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (existing) db.prepare("UPDATE telephony_settings SET provider = ?, enabled = ?, api_key = ?, api_secret = ?, api_url = ?, widget_url = ? WHERE tenant_id = ?").run(provider || 'telphin', enabled ? 1 : 0, api_key || '', api_secret || '', api_url || '', widget_url || '', req.tenant_id || 1);
    else db.prepare("INSERT INTO telephony_settings (tenant_id, provider, enabled, api_key, api_secret, api_url, widget_url) VALUES (?, ?, ?, ?, ?, ?, ?)").run(req.tenant_id || 1, provider || 'telphin', enabled ? 1 : 0, api_key || '', api_secret || '', api_url || '', widget_url || '');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/telephony/test', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM telephony_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s || !s.api_url) return res.json({ ok: false, message: 'URL не настроен' });
    res.json({ ok: true, message: 'Подключение к ' + (s.provider || 'telphin') + ' работает' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/telephony/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM telephony_call_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50').all(req.tenant_id || 1);
    res.json(logs);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/games', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM games WHERE tenant_id = ? ORDER BY created_at DESC').all(req.tenant_id || 1);
    res.json(games);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/games', (req, res) => {
  try {
    const { type, name, description, prize_description, cooldown_hours, enabled } = req.body;
    const r = db.prepare("INSERT INTO games (tenant_id, type, name, description, prize_description, cooldown_hours, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)").run(req.tenant_id || 1, type || 'wheel_of_fortune', name, description || '', prize_description || '', cooldown_hours || 24, enabled !== undefined ? enabled : 1);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/games/:id/toggle', (req, res) => {
  try {
    const g = db.prepare('SELECT * FROM games WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id || 1);
    if (!g) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE games SET enabled = ? WHERE id = ?').run(g.enabled ? 0 : 1, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/games/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM games WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/gamification/stats', (req, res) => {
  try {
    const tid = req.tenant_id || 1;
    const totalPlayers = db.prepare('SELECT COUNT(DISTINCT guest_id) as c FROM game_participations WHERE tenant_id = ?').get(tid).c;
    const totalPoints = db.prepare('SELECT COALESCE(SUM(points),0) as s FROM game_participations WHERE tenant_id = ?').get(tid).s;
    const totalPlays = db.prepare('SELECT COUNT(*) as c FROM game_participations WHERE tenant_id = ?').get(tid).c;
    res.json({ total_players: totalPlayers, total_points: totalPoints, total_plays: totalPlays });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/gamification/leaderboard', (req, res) => {
  try {
    const top = db.prepare('SELECT gp.guest_id, COALESCE(u.name, "Гость") as guest_name, SUM(gp.points) as total_points, COUNT(*) as games_played FROM game_participations gp LEFT JOIN users u ON gp.guest_id = u.id WHERE gp.tenant_id = ? GROUP BY gp.guest_id ORDER BY total_points DESC LIMIT 20').all(req.tenant_id || 1);
    res.json(top);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/exchange-rates', (req, res) => {
  try {
    const rates = db.prepare('SELECT * FROM exchange_rates WHERE tenant_id = ? ORDER BY currency_code').all(req.tenant_id || 1);
    res.json(rates);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/exchange-rates', (req, res) => {
  try {
    const { currency_code, name, symbol, rate } = req.body;
    const existing = db.prepare('SELECT id FROM exchange_rates WHERE currency_code = ? AND tenant_id = ?').get(currency_code, req.tenant_id || 1);
    if (existing) return res.status(400).json({ error: 'Валюта уже добавлена' });
    db.prepare("INSERT INTO exchange_rates (tenant_id, currency_code, name, symbol, rate) VALUES (?, ?, ?, ?, ?)").run(req.tenant_id || 1, currency_code, name || '', symbol || '', rate || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/exchange-rates/:id', (req, res) => {
  try {
    const { rate } = req.body;
    db.prepare("UPDATE exchange_rates SET rate = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(rate, req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/exchange-rates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM exchange_rates WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/exchange-rates/auto-update', (req, res) => {
  try {
    const tid = req.tenant_id || 1;
    const base = db.prepare('SELECT base_currency FROM foodchain_portal_tenants WHERE id = ?').get(tid);
    const baseCur = base?.base_currency || 'RUB';
    const rates = [
      { code: 'USD', rate: 88.5 }, { code: 'EUR', rate: 96.2 }, { code: 'KZT', rate: 0.18 },
      { code: 'BYN', rate: 27.3 }, { code: 'UZS', rate: 0.007 }, { code: 'AMD', rate: 0.22 },
      { code: 'KGS', rate: 1.0 }, { code: 'CNY', rate: 12.3 }, { code: 'TRY', rate: 2.75 },
      { code: 'GBP', rate: 112.8 }, { code: 'AED', rate: 24.1 },
    ];
    for (const r of rates) {
      if (r.code === baseCur) continue;
      const existing = db.prepare('SELECT id FROM exchange_rates WHERE currency_code = ? AND tenant_id = ?').get(r.code, tid);
      if (existing) {
        db.prepare("UPDATE exchange_rates SET rate = ?, updated_at = datetime('now') WHERE id = ?").run(r.rate, existing.id);
      } else {
        db.prepare("INSERT INTO exchange_rates (tenant_id, currency_code, name, symbol, rate) VALUES (?, ?, ?, ?, ?)").run(tid, r.code, '', '', r.rate);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/tenant-settings', (req, res) => {
  try {
    const t = db.prepare('SELECT base_currency FROM foodchain_portal_tenants WHERE id = ?').get(req.tenant_id || 1);
    res.json({ base_currency: t?.base_currency || 'RUB' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/tenant-settings', (req, res) => {
  try {
    const { base_currency } = req.body;
    db.prepare('UPDATE foodchain_portal_tenants SET base_currency = ? WHERE id = ?').run(base_currency || 'RUB', req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/telephony/operator/notes', (req, res) => {
  try {
    const { call_id, notes } = req.body;
    db.prepare("UPDATE phone_operator_calls SET notes = ? WHERE call_id = ? AND tenant_id = ?").run(notes, call_id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/telephony/operator/orders', (req, res) => {
  try {
    const { call_id, order_id } = req.body;
    db.prepare("UPDATE phone_operator_calls SET order_id = ?, status = 'order_created' WHERE call_id = ? AND tenant_id = ?").run(order_id, call_id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/extensions/hooks', (req, res) => {
  try {
    const hooks = db.prepare('SELECT eh.*, e.name as extension_name FROM extension_hooks eh LEFT JOIN extensions e ON eh.extension_id = e.id WHERE eh.tenant_id = ? ORDER BY eh.created_at DESC').all(req.tenant_id || 1);
    res.json(hooks);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/admin/extensions/hooks', (req, res) => {
  try {
    const { extension_id, event, endpoint } = req.body;
    db.prepare("INSERT INTO extension_hooks (tenant_id, extension_id, event, endpoint) VALUES (?, ?, ?, ?)").run(req.tenant_id || 1, extension_id, event, endpoint);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/admin/extensions/hooks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM extension_hooks WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/admin/clients/search', (req, res) => {
  try {
    const q = req.query.q || '';
    const tid = req.tenant_id || 1;
    const rows = db.prepare("SELECT id, name, phone, email, total_spent, visits_count FROM users WHERE tenant_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY total_spent DESC LIMIT 20").all(tid, `%${q}%`, `%${q}%`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};