
module.exports = function(app, db, config) {
  const { safeError, toCamelCase, toCamelCaseArray, supplierPortal, csvUpload } = config;

app.get('/api/suppliers', (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
    res.json(toCamelCaseArray(suppliers));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/suppliers', (req, res) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Название поставщика обязательно' });
    const info = db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)').run(name, contact_person || null, phone || null, email || null, address || null);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(supplier));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/suppliers/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Поставщик не найден' });
    const { name, contact_person, phone, email, address } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (contact_person !== undefined) { sets.push('contact_person = ?'); params.push(contact_person); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(supplier));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/suppliers/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Поставщик не найден' });
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/supplier-portal/auth', (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    const user = supplierPortal.authenticate(db, login, password);
    if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
    const token = supplierPortal.generateToken(user, SUPPLIER_JWT_SECRET);
    supplierPortal.logActivity(db, { supplierId: user.supplier_id, portalUserId: user.id, action: 'login', details: 'Supplier portal login' });
    res.json({ token, user: { id: user.id, supplier_id: user.supplier_id, supplier_name: user.supplier?.name || '', login: user.login, permissions: JSON.parse(user.permissions || '{}') } });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/supplier-portal/change-password', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Все поля обязательны' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    const user = db.prepare('SELECT * FROM supplier_portal_users WHERE id = ?').get(auth.id);
    if (!user || !supplierPortal.verifyPassword(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Неверный текущий пароль' });
    const hash = supplierPortal.hashPassword(newPassword);
    db.prepare("UPDATE supplier_portal_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, auth.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/supplier-portal/check', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ ok: true, user: auth });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/supplier-portal/dashboard', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const stats = supplierPortal.getDashboardStats(db, auth.supplier_id);
    const recentOrders = db.prepare('SELECT * FROM supplier_order_history WHERE supplier_id = ? AND tenant_id = 1 ORDER BY created_at DESC LIMIT 5').all(auth.supplier_id);
    res.json({ ...stats, recentOrders });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/supplier-portal/products', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const products = supplierPortal.getProductCatalog(db, auth.supplier_id);
    res.json(products);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/supplier-portal/prices', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.prices) return res.status(403).json({ error: 'Нет прав на изменение цен' });
    const result = supplierPortal.updatePrices(db, auth.supplier_id, req.body.prices || []);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: 'update_prices', details: `Updated ${result.updated} prices` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/supplier-portal/prices/import', csvUpload.single('file'), (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.prices) return res.status(403).json({ error: 'Нет прав на изменение цен' });
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const content = req.file.buffer.toString('utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'Файл не содержит данных' });
    const headerMap = { 'артикул': 'article', 'article': 'article', 'sku': 'article', 'наименование': 'name', 'name': 'name', 'штрихкод': 'barcode', 'barcode': 'barcode', 'цена': 'price', 'price': 'price' };
    const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
    const headers = rawHeaders.map(h => headerMap[h] || h);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
      rows.push(row);
    }
    const result = supplierPortal.importPricesFromExcel(db, auth.supplier_id, rows);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: 'import_prices', details: `Imported ${result.imported}/${result.total} prices` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/supplier-portal/stock', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.stock) return res.status(403).json({ error: 'Нет прав на изменение остатков' });
    const result = supplierPortal.updateStock(db, auth.supplier_id, req.body.stock || []);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: 'update_stock', details: `Updated ${result.updated} stock items` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/supplier-portal/orders', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const status = req.query.status;
    let orders = supplierPortal.getOrders(db, auth.supplier_id);
    if (status && status !== 'all') orders = orders.filter(o => o.status === status);
    res.json(orders);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/supplier-portal/orders/:id/status', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.orders) return res.status(403).json({ error: 'Нет прав на изменение заказов' });
    const result = supplierPortal.confirmOrder(db, req.params.id, auth.supplier_id, req.body.status);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: `order_${req.body.status}`, details: `Order #${result.order_id || result.id}` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};