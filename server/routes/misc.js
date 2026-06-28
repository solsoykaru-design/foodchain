const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

module.exports = function(app, db, config) {
  const { io, JWT_SECRET, PORTAL_SYNC_KEY, upload, broadcast, safeError, toCamelCase, toCamelCaseArray, getOrderFull, STATUS_CHAIN, checkRoleLimit, emailService, pushService, notifLog, uploadChat, uploadAppImage } = config;

app.get('/tg-app', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'tg-app.html')));
app.get('/login', (req, res) => {
  res.redirect('/portal/login');
});
app.post('/api/internal/sync-staff', (req, res) => {
  try {
    const { key, staff } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Forbidden' });

    const { tenant_id, username, password_hash, role, first_name, last_name, phone, email } = staff;
    if (!tenant_id || !username || !password_hash) {
      return res.status(400).json({ error: 'tenant_id, username, password_hash required' });
    }

    // Look up by username + tenant_id to prevent cross-tenant overwrites
    const existing = db.prepare('SELECT id, role FROM staff WHERE username = ? AND tenant_id = ?').get(username, tenant_id);
    if (!existing) {
      const limitCheck = checkRoleLimit(db, tenant_id, role || 'waiter', true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    } else if (role && role !== existing.role) {
      const limitCheck = checkRoleLimit(db, tenant_id, role, true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (existing) {
      db.prepare(`UPDATE staff SET password=?, role=?, first_name=?, last_name=?, phone=?, email=? WHERE id=?`)
        .run(password_hash, role || 'waiter', first_name || username, last_name || null, phone || null, email || null, existing.id);
    } else {
      db.prepare(`INSERT INTO staff (username, password, role, first_name, last_name, phone, email, tenant_id, is_active) VALUES (?,?,?,?,?,?,?,?,1)`)
        .run(username, password_hash, role || 'waiter', first_name || username, last_name || null, phone || null, email || null, tenant_id);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/couriers', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });
  const info = db.prepare('INSERT INTO couriers (name, phone) VALUES (?, ?)').run(name, phone);
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(toCamelCase(courier));
});
app.get('/api/notifications', (req, res) => {
  const { user_id, courier_id } = req.query;
  let sql = 'SELECT * FROM notifications WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND user_id = ?'; params.push(Number(user_id)); }
  if (courier_id) { sql += ' AND courier_id = ?'; params.push(Number(courier_id)); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  res.json(toCamelCaseArray(db.prepare(sql).all(...params)));
});
app.post('/api/notifications', (req, res) => {
  const { user_id, courier_id, title, body } = req.body;
  const info = db.prepare('INSERT INTO notifications (user_id, courier_id, title, body) VALUES (?, ?, ?, ?)').run(user_id || null, courier_id || null, title, body || '');
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  io.emit('notification', toCamelCase(notif));
  res.status(201).json(toCamelCase(notif));
});
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой (максимум 5MB)' });
        return res.status(400).json({ error: 'Ошибка загрузки: ' + err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
      // Upload to Supabase Storage as cloud backup
      try {
        const supabase = require('../lib/supabase');
        const sb = supabase.getClient();
        if (sb) {
          const filePath = 'uploads/' + req.file.filename;
          supabase.ensureBucket('foodchain-uploads', { public: true, fileSizeLimit: 52428800 }).then(() => {
            supabase.uploadFile('foodchain-uploads', filePath, fs.readFileSync(req.file.path), req.file.mimetype);
          }).catch(e => console.log('[upload] Supabase backup failed:', e.message));
        }
      } catch (e) { /* Supabase not configured — ignore */ }
      res.json({ url: '/uploads/' + req.file.filename });
    } catch (e) {
      console.error('POST /api/upload error:', e.message);
      res.status(500).json({ error: safeError(e.message) });
    }
  });
});
app.put('/api/website/user/profile', (req, res) => {
  try {
    const { userId, name, phone } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
    if (phone) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, userId);
    const user = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(userId);
    res.json(user ? toCamelCase(user) : { ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/offline/sync', (req, res) => {
  try {
    const { actions, last_sync_at } = req.body;
    const results = [];
    const syncData = {};

    if (actions && Array.isArray(actions)) {
      const txn = db.transaction(() => {
        for (const action of actions) {
          try {
            const { type, data, local_id, timestamp } = action;
            let result = { local_id, status: 'synced', server_id: null, conflict_with: null };

            // Conflict resolution: check updated_at before applying mutations
            if (type === 'update_order_status') {
              const existing = db.prepare("SELECT updated_at FROM orders WHERE id = ?").get(data.order_id);
              if (existing && timestamp && existing.updated_at > timestamp) {
                result.status = 'conflict';
                result.server_id = data.order_id;
                result.conflict_with = existing;
                results.push(result);
                continue;
              }
            }
            if (type === 'create_order') {
              const info = db.prepare('INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, delivery_fee, discount, total, payment_method, type, status, address, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                data.user_id || 0, data.user_name || '', data.user_phone || '', JSON.stringify(data.items || []),
                data.subtotal || 0, data.delivery_fee || 0, data.discount || 0, data.total || 0,
                data.payment_method || 'cash', data.type || 'delivery', 'new', data.address || '', data.comment || '',
                timestamp || new Date().toISOString()
              );
              result.server_id = info.lastInsertRowid;
            } else if (type === 'update_order_status') {
              db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(data.status, data.order_id);
              result.server_id = data.order_id;
            } else if (type === 'create_transaction') {
              const info = db.prepare('INSERT INTO finance_transactions (type, category, amount, payment_method, description, date) VALUES (?, ?, ?, ?, ?, ?)').run(
                data.type || 'income', data.category || 'other', data.amount || 0, data.payment_method || 'cash', data.description || '', data.date || new Date().toISOString().split('T')[0]
              );
              result.server_id = info.lastInsertRowid;
            }

            results.push(result);
          } catch (e) {
            results.push({ local_id: action?.local_id, status: 'error', error: safeError(e.message) });
          }
        }
      });
      txn();
    }

    // Return current state for local cache
    const since = last_sync_at || '2000-01-01';
    syncData.orders = db.prepare("SELECT id, status, updated_at FROM orders WHERE updated_at > ? OR created_at > ?").all(since, since);
    syncData.menu_categories = db.prepare("SELECT id, name, sort_order, is_active, icon, parent_id, created_at, updated_at FROM menu_categories WHERE updated_at > ? OR created_at > ?").all(since, since);
    syncData.dishes = db.prepare("SELECT id, name, price, is_active as status, category_id, barcode, article, is_available, updated_at, created_at FROM dishes WHERE updated_at > ? OR created_at > ?").all(since, since);
    syncData.inventory_items = db.prepare("SELECT id, name, article, unit, COALESCE(current_stock, current_balance, 0) as current_stock, barcode FROM inventory_items WHERE tenant_id = current_tenant_id()").all();
    syncData.settings = db.prepare("SELECT key, value FROM settings WHERE tenant_id = 1").all();

    res.json({ synced: results, syncData });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/contragents', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM contragents WHERE tenant_id = 1';
    const params = [];
    if (search) { sql += ' AND (company_name LIKE ? OR full_name LIKE ? OR inn LIKE ? OR phone LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s); }
    sql += ' ORDER BY company_name ASC';
    const items = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(items));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/contragents', (req, res) => {
  try {
    const b = req.body;
    if (!b.companyName || !b.companyName.trim()) return res.status(400).json({ error: 'Название компании обязательно' });
    if (!b.fullName || !b.fullName.trim()) return res.status(400).json({ error: 'Полное название юр. лица обязательно' });
    if (b.inn && !/^\d{10}$|^\d{12}$/.test(b.inn)) return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' });
    if (b.kpp && !/^\d{9}$/.test(b.kpp)) return res.status(400).json({ error: 'КПП должен содержать 9 цифр' });
    if (b.bik && !/^\d{9}$/.test(b.bik)) return res.status(400).json({ error: 'БИК должен содержать 9 цифр' });
    if (b.bankAccount && !/^\d{20}$/.test(b.bankAccount)) return res.status(400).json({ error: 'Расчётный счёт должен содержать 20 цифр' });
    if (b.correspondentAccount && !/^\d{20}$/.test(b.correspondentAccount)) return res.status(400).json({ error: 'Корр. счёт должен содержать 20 цифр' });
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ error: 'Некорректный email' });

    const info = db.prepare(`INSERT INTO contragents (
      tenant_id, company_name, full_name, type, inn, kpp,
      legal_country, legal_region, legal_city, legal_street, legal_house, legal_index,
      actual_country, actual_region, actual_city, actual_street, actual_house, actual_index,
      bank_account, bank_name, bank_address, bik, correspondent_account,
      contract_number, contract_date, vat_included, wholesale_price_list,
      cost_item_debit, cost_item_credit, contact_person, phone, email, website,
      supplier_number, work_conditions, description, id_1c,
      min_order_sum, credit_limit, payment_deferral_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      1, b.companyName, b.fullName, b.type || 'ip', b.inn || null, b.kpp || null,
      b.legalCountry || 'Российская Федерация', b.legalRegion || null, b.legalCity || null, b.legalStreet || null, b.legalHouse || null, b.legalIndex || null,
      b.actualCountry || 'Российская Федерация', b.actualRegion || null, b.actualCity || null, b.actualStreet || null, b.actualHouse || null, b.actualIndex || null,
      b.bankAccount || null, b.bankName || null, b.bankAddress || null, b.bik || null, b.correspondentAccount || null,
      b.contractNumber || null, b.contractDate || null, b.vatIncluded ? 1 : 0, b.wholesalePriceList || null,
      b.costItemDebit || null, b.costItemCredit || null, b.contactPerson || null, b.phone || null, b.email || null, b.website || null,
      b.supplierNumber || null, b.workConditions || null, b.description || null, b.id1c || null,
      parseFloat(b.minOrderSum) || 0, parseFloat(b.creditLimit) || 0, parseInt(b.paymentDeferralDays) || 0
    );
    const item = db.prepare('SELECT * FROM contragents WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/contragents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contragents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Контрагент не найден' });
    const b = req.body;
    if (b.inn && !/^\d{10}$|^\d{12}$/.test(b.inn)) return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' });
    if (b.kpp && !/^\d{9}$/.test(b.kpp)) return res.status(400).json({ error: 'КПП должен содержать 9 цифр' });
    if (b.bik && !/^\d{9}$/.test(b.bik)) return res.status(400).json({ error: 'БИК должен содержать 9 цифр' });
    if (b.bankAccount && !/^\d{20}$/.test(b.bankAccount)) return res.status(400).json({ error: 'Расчётный счёт должен содержать 20 цифр' });
    if (b.correspondentAccount && !/^\d{20}$/.test(b.correspondentAccount)) return res.status(400).json({ error: 'Корр. счёт должен содержать 20 цифр' });
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ error: 'Некорректный email' });
    const fields = [
      'companyName', 'fullName', 'type', 'inn', 'kpp',
      'legalCountry', 'legalRegion', 'legalCity', 'legalStreet', 'legalHouse', 'legalIndex',
      'actualCountry', 'actualRegion', 'actualCity', 'actualStreet', 'actualHouse', 'actualIndex',
      'bankAccount', 'bankName', 'bankAddress', 'bik', 'correspondentAccount',
      'contractNumber', 'contractDate', 'vatIncluded', 'wholesalePriceList',
      'costItemDebit', 'costItemCredit', 'contactPerson', 'phone', 'email', 'website',
      'supplierNumber', 'workConditions', 'description', 'id1c',
      'minOrderSum', 'creditLimit', 'paymentDeferralDays'
    ];
    const colMap = { companyName: 'company_name', fullName: 'full_name', legalCountry: 'legal_country', legalRegion: 'legal_region', legalCity: 'legal_city', legalStreet: 'legal_street', legalHouse: 'legal_house', legalIndex: 'legal_index', actualCountry: 'actual_country', actualRegion: 'actual_region', actualCity: 'actual_city', actualStreet: 'actual_street', actualHouse: 'actual_house', actualIndex: 'actual_index', bankAccount: 'bank_account', bankName: 'bank_name', bankAddress: 'bank_address', correspondentAccount: 'correspondent_account', contractNumber: 'contract_number', contractDate: 'contract_date', vatIncluded: 'vat_included', wholesalePriceList: 'wholesale_price_list', costItemDebit: 'cost_item_debit', costItemCredit: 'cost_item_credit', contactPerson: 'contact_person', supplierNumber: 'supplier_number', workConditions: 'work_conditions', id1c: 'id_1c', minOrderSum: 'min_order_sum', creditLimit: 'credit_limit', paymentDeferralDays: 'payment_deferral_days' };
    const sets = []; const vals = [];
    for (const f of fields) {
      if (b[f] !== undefined) {
        const col = colMap[f] || f;
        sets.push(`${col} = ?`);
        vals.push(f === 'vatIncluded' ? (b[f] ? 1 : 0) : f === 'minOrderSum' || f === 'creditLimit' ? parseFloat(b[f]) || 0 : f === 'paymentDeferralDays' ? parseInt(b[f]) || 0 : b[f]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.id);
    db.prepare(`UPDATE contragents SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    const item = db.prepare('SELECT * FROM contragents WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/contragents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contragents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Контрагент не найден' });
    db.prepare('DELETE FROM contragents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/pickup-points', (req, res) => {
  try {
    const points = db.prepare('SELECT * FROM pickup_points ORDER BY display_order ASC, name ASC').all();
    res.json(toCamelCaseArray(points));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/pickup-points', (req, res) => {
  try {
    const { name, address, lat, lng, phone, description, working_hours, image_url, estimated_ready_minutes, is_active, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const info = db.prepare('INSERT INTO pickup_points (name, address, lat, lng, phone, description, working_hours, image_url, estimated_ready_minutes, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, address || '', lat || null, lng || null, phone || '', description || '',
      typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours || {}),
      image_url || '', estimated_ready_minutes || 15, is_active !== undefined ? (is_active ? 1 : 0) : 1, display_order || 0
    );
    const point = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(point));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/pickup-points/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Пункт выдачи не найден' });
    const { name, address, lat, lng, phone, description, working_hours, image_url, estimated_ready_minutes, is_active, display_order } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }
    if (lat !== undefined) { sets.push('lat = ?'); params.push(lat); }
    if (lng !== undefined) { sets.push('lng = ?'); params.push(lng); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (working_hours !== undefined) { sets.push('working_hours = ?'); params.push(typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours)); }
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (estimated_ready_minutes !== undefined) { sets.push('estimated_ready_minutes = ?'); params.push(estimated_ready_minutes); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (display_order !== undefined) { sets.push('display_order = ?'); params.push(display_order); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE pickup_points SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const point = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(point));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/pickup-points/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Пункт выдачи не найден' });
    db.prepare('DELETE FROM pickup_points WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/pickup-orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE type = 'pickup' AND status IN ('new','confirmed','preparing','ready') ORDER BY created_at DESC").all();
    const result = orders.map(o => {
      const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
      return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)) });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/user/theme', (req, res) => {
  try {
    const { theme_id, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });
    const theme = db.prepare('SELECT id FROM themes WHERE id = ? AND is_active = 1').get(theme_id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена или неактивна' });
    db.prepare('UPDATE users SET theme_id = ? WHERE id = ?').run(theme_id || null, user_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/user/theme', (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });
    const user = db.prepare('SELECT theme_id FROM users WHERE id = ?').get(Number(user_id));
    res.json({ theme_id: user?.theme_id || null });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/delivery-orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE status IN ('assigned','en_route','delivered') ORDER BY created_at DESC").all();
    const result = orders.map(o => {
      const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
      let courierPhone = null;
      if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
      return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/delivery-zones', (req, res) => {
  try {
    const zones = db.prepare('SELECT * FROM delivery_zones ORDER BY name ASC').all();
    res.json(toCamelCaseArray(zones));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/delivery-zones', (req, res) => {
  try {
    const { name, radius_km, min_order, delivery_price, estimated_time } = req.body;
    if (!name) return res.status(400).json({ error: 'Название зоны обязательно' });
    const info = db.prepare('INSERT INTO delivery_zones (name, radius_km, min_order, delivery_price, estimated_time) VALUES (?, ?, ?, ?, ?)').run(
      name, radius_km || null, min_order || 0, delivery_price || 0, estimated_time || null
    );
    const zone = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(zone));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/delivery-zones/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Зона не найдена' });
    const { name, radius_km, min_order, delivery_price, estimated_time } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (radius_km !== undefined) { sets.push('radius_km = ?'); params.push(radius_km); }
    if (min_order !== undefined) { sets.push('min_order = ?'); params.push(min_order); }
    if (delivery_price !== undefined) { sets.push('delivery_price = ?'); params.push(delivery_price); }
    if (estimated_time !== undefined) { sets.push('estimated_time = ?'); params.push(estimated_time); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE delivery_zones SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const zone = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(zone));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/delivery-zones/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Зона не найдена' });
    db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/generate-code', (req, res) => {
  try {
    const { type, length } = req.body;
    const len = Math.max(4, Math.min(32, Number(length) || 8));
    const chars = type === 'letters' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' :
      type === 'digits' ? '0123456789' :
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    res.json({ code });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/public/settings', (req, res) => {
  try {
    const publicKeys = [
      'app_name', 'phone', 'address', 'logo_path', 'currency',
      'working_time_start', 'working_time_end', 'timezone',
      'enable_delivery', 'enable_pickup',
      'delivery_cost', 'free_delivery_from', 'min_delivery_amount', 'min_order_amount',
      'max_check', 'min_return',
      'tips_message', 'tip_1', 'tip_2', 'tip_3',
      'initial_points', 'money_points_rate', 'auto_burn_points', 'burn_days',
      'return_days', 'tax_type', 'confirmation_phrase',
      'site_mode', 'main_store',
      'enable_item_comments', 'enable_qr_card', 'request_birthday', 'request_email',
      'wallet_enabled', 'show_available_quantity_online', 'limit_points_for_delivery',
      'allow_orders_without_auth', 'allow_registered_without_auth',
    ];
    const placeholders = publicKeys.map(() => '?').join(',');
    const rows = db.prepare(`SELECT key, value, type FROM system_settings WHERE key IN (${placeholders})`).all(...publicKeys);
    const settings = {};
    for (const row of rows) {
      let val = row.value;
      if (row.type === 'boolean') val = val === 'true' || val === '1';
      else if (row.type === 'number') val = Number(val);
      else if (row.type === 'json') { try { val = JSON.parse(val); } catch (e) {} }
      settings[row.key] = val;
    }
    const tenant = db.prepare("SELECT access_mode FROM foodchain_portal_tenants LIMIT 1").get();
    settings.access_mode = tenant?.access_mode || 'production';
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/public/menu', (req, res) => {
  try {
    const channel = req.query.channel;
    const validChannels = ['site', 'app', 'kiosk', 'waiter', 'aggregators'];
    if (!channel || !validChannels.includes(channel)) {
      return res.status(400).json({ error: `channel is required: ${validChannels.join(', ')}` });
    }
    const col = `show_on_${channel}`;
    const categories = db.prepare(`
      SELECT id, name, icon, parent_id, sort_order, image_url
      FROM menu_categories
      WHERE ${col} = 1
      ORDER BY sort_order ASC, name ASC
    `).all();
    const categoryIds = categories.map(c => c.id);
    let dishes = [];
    if (categoryIds.length > 0) {
      dishes = db.prepare(`
        SELECT d.*
        FROM dishes d
        JOIN menu_categories mc ON d.category_id = mc.id
        WHERE mc.${col} = 1 AND d.is_available = 1
        ORDER BY d.display_order ASC, d.name ASC
      `).all();
    }
    res.json({ categories: toCamelCaseArray(categories), dishes: toCamelCaseArray(dishes) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/statuses', (req, res) => {
  res.json(STATUS_CHAIN);
});
app.get('/api/weekly-menu', (req, res) => {
  try {
    const items = db.prepare(`SELECT wm.*, d.name as dish_name FROM weekly_menu wm LEFT JOIN dishes d ON wm.dish_id = d.id WHERE wm.tenant_id = current_tenant_id() ORDER BY wm.day_of_week, wm.sort_order`).all();
    const grouped = {};
    for (const item of items) {
      const day = item.day_of_week;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({ id: item.id, dishId: item.dish_id, dishName: item.dish_name, categoryId: item.category_id, sortOrder: item.sort_order });
    }
    res.json(grouped);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/weekly-menu', (req, res) => {
  try {
    const { dayOfWeek, dishId, categoryId, sortOrder } = req.body;
    db.prepare('INSERT INTO weekly_menu (day_of_week, dish_id, category_id, sort_order) VALUES (?, ?, ?, ?)').run(dayOfWeek, dishId, categoryId || null, sortOrder || 0);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/weekly-menu/:id', (req, res) => {
  try { db.prepare('DELETE FROM weekly_menu WHERE id = ?').run(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/languages', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM languages ORDER BY sort_order').all()); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/languages', (req, res) => {
  try {
    const { name, code, isActive, sortOrder } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name and code required' });
    const info = db.prepare('INSERT INTO languages (name, code, is_active, sort_order) VALUES (?, ?, ?, ?)').run(name, code, isActive !== undefined ? (isActive ? 1 : 0) : 1, sortOrder || 0);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/languages/:id', (req, res) => {
  try {
    const b = req.body;
    const sets = []; const vals = [];
    if (b.name !== undefined) { sets.push('name = ?'); vals.push(b.name); }
    if (b.code !== undefined) { sets.push('code = ?'); vals.push(b.code); }
    if (b.isActive !== undefined) { sets.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if (b.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(b.sortOrder); }
    if (sets.length) { vals.push(req.params.id); db.prepare(`UPDATE languages SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/languages/:id', (req, res) => {
  try { db.prepare('DELETE FROM languages WHERE id = ?').run(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/dish-modifiers/:dishId', (req, res) => {
  try {
    const items = db.prepare('SELECT dm.*, m.name as modifier_name, m.price as modifier_price, mg.name as group_name FROM dish_modifiers dm LEFT JOIN modifiers m ON dm.modifier_id = m.id LEFT JOIN modifier_groups mg ON m.group_id = mg.id WHERE dm.dish_id = ? AND dm.tenant_id = current_tenant_id() ORDER BY dm.sort_order').all(req.params.dishId);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/dish-modifiers', (req, res) => {
  try {
    const { dishId, modifierId, sortOrder } = req.body;
    const info = db.prepare('INSERT INTO dish_modifiers (dish_id, modifier_id, sort_order) VALUES (?, ?, ?)').run(dishId, modifierId, sortOrder || 0);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/dish-modifiers/:id', (req, res) => {
  try { db.prepare('DELETE FROM dish_modifiers WHERE id = ?').run(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/languages-page-data', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    db.prepare('DELETE FROM languages').run();
    const ins = db.prepare('INSERT INTO languages (name, code, is_active, sort_order) VALUES (?, ?, ?, ?)');
    for (const item of items) { ins.run(item.name, item.code, item.isActive ? 1 : 0, item.sortOrder || 0); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/branches', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM branches WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(tenant_id); }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/branches', (req, res) => {
  try {
    const { tenant_id, name, address, phone } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: 'tenant_id and name are required' });

    // Skip allow_create_branches check when called by portal backend with sync key
    const portalSyncKey = req.headers['x-portal-sync-key'];
    if (portalSyncKey !== PORTAL_SYNC_KEY) {
      const tenant = db.prepare('SELECT allow_create_branches FROM foodchain_portal_tenants WHERE id = ?').get(tenant_id);
      if (tenant && !tenant.allow_create_branches) {
        return res.status(403).json({ error: 'Функция недоступна, обратитесь к суперадминистратору' });
      }
    }

    const info = db.prepare('INSERT INTO branches (tenant_id, name, address, phone) VALUES (?, ?, ?, ?)').run(
      tenant_id, name, address || null, phone || null
    );
    res.status(201).json(db.prepare('SELECT * FROM branches WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/branches/:id', (req, res) => {
  try {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const sets = []; const params = [];
    for (const key of ['name', 'address', 'phone', 'is_active']) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE branches SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/branches/:id', (req, res) => {
  try {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
    res.json({ message: 'Branch deleted' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
function notifySuperadminNewTenant(tenantInfo) {
  try {
    const superadmin = db.prepare("SELECT id, email, name FROM users WHERE login = 'ali' AND role = 'superadmin'").get();
    if (!superadmin) return;

    const title = 'Новый арендатор: ' + (tenantInfo.name || tenantInfo.nickname || 'Без имени');
    const tenantNick = tenantInfo.nickname || tenantInfo.name || '';
    const adminLogin = tenantInfo.admin_login || '';
    const adminEmail = tenantInfo.admin_email || '';
    const tariffName = tenantInfo.tariff_name || '';
    const subscriptionStart = tenantInfo.subscription_start || '';
    const subscriptionEnd = tenantInfo.subscription_end || '';
    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyLines = [
      'Название: ' + (tenantInfo.name || '—'),
      'Никнейм: ' + tenantNick,
      adminLogin ? 'Логин администратора: ' + adminLogin : '',
      adminEmail ? 'Email администратора: ' + adminEmail : '',
      tariffName ? 'Тариф: ' + tariffName : '',
      subscriptionStart ? 'Подписка с: ' + subscriptionStart : '',
      subscriptionEnd ? 'Подписка до: ' + subscriptionEnd : '',
      'Дата регистрации: ' + date,
    ];
    const body = bodyLines.filter(Boolean).join('\n');

    const ins = db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(superadmin.id, title, body);
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(ins.lastInsertRowid);
    if (notif && io) {
      try { io.emit('notification', toCamelCase(notif)); } catch {}
    }

    if (superadmin.email && emailService) {
      const rows = [
        '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Название</td><td style="padding:8px 12px;border:1px solid #ddd;">' + (tenantInfo.name || '—') + '</td></tr>',
        '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Никнейм</td><td style="padding:8px 12px;border:1px solid #ddd;">' + tenantNick + '</td></tr>',
        adminLogin ? '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Логин администратора</td><td style="padding:8px 12px;border:1px solid #ddd;">' + adminLogin + '</td></tr>' : '',
        adminEmail ? '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Email администратора</td><td style="padding:8px 12px;border:1px solid #ddd;">' + adminEmail + '</td></tr>' : '',
        tariffName ? '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Тариф</td><td style="padding:8px 12px;border:1px solid #ddd;">' + tariffName + '</td></tr>' : '',
        subscriptionStart ? '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Подписка действует с</td><td style="padding:8px 12px;border:1px solid #ddd;">' + subscriptionStart + '</td></tr>' : '',
        subscriptionEnd ? '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Подписка действует до</td><td style="padding:8px 12px;border:1px solid #ddd;">' + subscriptionEnd + '</td></tr>' : '',
        '<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">Дата регистрации</td><td style="padding:8px 12px;border:1px solid #ddd;">' + date + '</td></tr>',
      ];
      const html = [
        '<h2 style="color:#1e40af;">Новый арендатор зарегистрирован</h2>',
        '<table style="border-collapse:collapse;width:100%;max-width:500px;">',
        rows.filter(Boolean).join('\n'),
        '</table>',
        '<p style="margin-top:16px;"><a href="' + (process.env.PUBLIC_URL || 'http://localhost:4000') + '/portal/admin/tenants" style="display:inline-block;background:#1e40af;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Перейти к списку арендаторов</a></p>',
        '<hr style="margin-top:24px;border:none;border-top:1px solid #e2e8f0;"/>',
        '<p style="color:#94a3b8;font-size:12px;">Это письмо отправлено автоматически системой FoodChain.</p>',
      ].join('\n');
      emailService.sendMail(db, { to: superadmin.email, subject: title, html: html }, null).catch(() => {});
    }
  } catch (e) {
    console.error('[notifySuperadminNewTenant] Error:', e.message);
  }
}

app.post('/api/internal/sync-tenant', (req, res) => {
  try {
    const { key, tenant } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant || !tenant.id) return res.status(400).json({ error: 'tenant.id required' });

    const existing = db.prepare('SELECT id, access_mode, app_settings, base_currency FROM foodchain_portal_tenants WHERE id = ?').get(tenant.id);
    const mode = tenant.access_mode || 'production';
    let appSettings = tenant.app_settings || existing?.app_settings || null;
    // Normalize old format ({"courier":{"enabled":true,"limit":5}}) to new format ({"courier":5})
    if (appSettings && typeof appSettings === 'string') {
      try {
        const parsed = JSON.parse(appSettings);
        let needsNormalize = false;
        const normalized = {};
        for (const key of ['admin','waiter','chef','kitchen','courier','manager','stock_manager','guest']) {
          const val = parsed[key];
          if (typeof val === 'object' && val !== null) {
            normalized[key] = val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : -1);
            needsNormalize = true;
          } else if (typeof val === 'number') {
            normalized[key] = val;
          } else {
            normalized[key] = -1;
          }
        }
        if (needsNormalize) appSettings = JSON.stringify(normalized);
      } catch {}
    }
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET name = ?, nickname = ?, allow_create_branches = ?, access_mode = ?, app_settings = ?, base_currency = ? WHERE id = ?')
        .run(tenant.name || '', tenant.nickname || '', tenant.allow_create_branches ? 1 : 0, mode, appSettings, tenant.base_currency || existing?.base_currency || 'RUB', tenant.id);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, name, nickname, allow_create_branches, access_mode, app_settings, base_currency) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(tenant.id, tenant.name || '', tenant.nickname || '', tenant.allow_create_branches ? 1 : 0, mode, appSettings, tenant.base_currency || 'RUB');
      // Seed demo data only when explicitly requested
      if (tenant.with_demo_data) {
        seedDemoData(db, bcrypt, tenant.id);
        db.prepare('UPDATE foodchain_portal_tenants SET demo_data_created_at = datetime(\'now\') WHERE id = ?').run(tenant.id);
      }
      notifySuperadminNewTenant(tenant);
    }
    res.json({ synced: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/internal/tenant-stats', (req, res) => {
  try {
    const { tenant_id, key } = req.query;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    const row = db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) as revenue FROM orders WHERE tenant_id = ?").get(tenant_id);
    const ordersCount = row.cnt || 0;
    const monthlyRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE tenant_id = ? AND status = 'delivered' AND created_at >= datetime('now', '-30 days')").get(tenant_id).t || 0;

    res.json({ orders_count: ordersCount, monthly_revenue: monthlyRevenue, tenant_id: parseInt(tenant_id) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/internal/delete-tenant', (req, res) => {
  try {
    const { key, tenant_id } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    db.prepare('DELETE FROM foodchain_portal_tenants WHERE id = ?').run(tenant_id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: send welcome email to new tenant (called by portal) ─────
app.post('/api/internal/send-welcome-email', (req, res) => {
  try {
    const { key, tenant } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant || !tenant.email) return res.status(400).json({ error: 'tenant.email required' });

    if (!emailService || !emailService.sendMail) return res.json({ skipped: true, reason: 'emailService not configured' });

    const login = tenant.admin_login || '';
    const password = tenant.admin_password || '';

    const html = [
      '<div style="max-width:600px;margin:auto;font-family:Inter,sans-serif;">',
      '<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center;border-radius:16px 16px 0 0;">',
      '<h1 style="color:white;margin:0;font-size:24px;">Добро пожаловать в FoodChain!</h1>',
      '</div>',
      '<div style="padding:32px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">',
      '<p style="color:#334155;">Ваш ресторан <strong>' + (tenant.name || '') + '</strong> успешно зарегистрирован в системе FoodChain.</p>',
      '<h2 style="color:#1e40af;font-size:18px;margin-top:24px;">Данные для входа</h2>',
      '<table style="border-collapse:collapse;width:100%;background:white;border-radius:8px;overflow:hidden;">',
      '<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Ресторан (никнейм)</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">' + (tenant.nickname || tenant.name || '') + '</td></tr>',
      login ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Логин администратора</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">' + login + '</code></td></tr>' : '',
      password ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Пароль</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;"><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px;">' + password + '</code></td></tr>' : '',
      '<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Дата регистрации</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">' + new Date().toLocaleDateString('ru-RU') + '</td></tr>',
      tenant.tariff_name ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Тариф</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">' + tenant.tariff_name + '</td></tr>' : '',
      tenant.subscription_start ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#475569;">Подписка действует с</td><td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">' + tenant.subscription_start + '</td></tr>' : '',
      tenant.subscription_end ? '<tr><td style="padding:10px 16px;font-weight:600;color:#475569;">Подписка действует до</td><td style="padding:10px 16px;">' + tenant.subscription_end + '</td></tr>' : '',
      '</table>',
      '<h2 style="color:#1e40af;font-size:18px;margin-top:24px;">Ссылки</h2>',
      '<p style="color:#334155;line-height:1.8;">',
      '🔗 <a href="' + (process.env.PUBLIC_URL || 'http://localhost:5180') + '/portal" style="color:#3b82f6;">Портал арендатора</a><br/>',
      '📱 <a href="' + (process.env.PUBLIC_URL || 'http://localhost:5180') + '/portal/apps" style="color:#3b82f6;">Скачать приложения</a> (гость, курьер, официант, кухня)',
      '</p>',
      '<h2 style="color:#1e40af;font-size:18px;margin-top:24px;">Быстрый старт</h2>',
      '<ol style="color:#334155;line-height:1.8;padding-left:20px;">',
      '<li><strong>Войдите</strong> в портал арендатора по ссылке выше, используя логин и пароль администратора</li>',
      '<li><strong>Добавьте меню</strong> — создайте категории и блюда, установите цены</li>',
      '<li><strong>Подключите сотрудников</strong> — в разделе «Персонал» добавьте официантов, поваров, курьеров</li>',
      '<li><strong>Настройте доставку</strong> — укажите адрес ресторана, зону доставки, способы оплаты</li>',
      '<li><strong>Запускайте</strong> — после настройки ресторан готов к приёму заказов!</li>',
      '</ol>',
      '<p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">Это письмо отправлено автоматически. Если у вас возникли вопросы, обратитесь в службу поддержки.</p>',
      '</div></div>',
    ].join('\n');

    emailService.sendMail(db, { to: tenant.email, subject: 'Добро пожаловать в FoodChain! Ваш ресторан зарегистрирован', html: html }, null, notifLog).catch(e => console.error('[sendWelcomeEmail]', e.message));
    res.json({ sent: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: send notification email to tenant (called by portal) ─────
app.post('/api/internal/send-notification-email', (req, res) => {
  try {
    const { key, to, subject, html } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!to || !subject) return res.status(400).json({ error: 'to and subject required' });

    if (!emailService || !emailService.sendMail) return res.json({ skipped: true, reason: 'emailService not configured' });

    emailService.sendMail(db, { to, subject, html: html || '<p>' + subject + '</p>' }, null, notifLog).catch(e => console.error('[sendNotificationEmail]', e.message));
    res.json({ sent: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/internal/reset-demo-data', (req, res) => {
  try {
    const { key, tenant_id } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    // Read current access_mode from foodchain_portal_tenants
    const pt = db.prepare('SELECT access_mode FROM foodchain_portal_tenants WHERE id = ?').get(tenant_id);
    if (!pt || pt.access_mode !== 'demo') {
      return res.status(400).json({ error: 'Tenant is not in demo mode' });
    }

    // Clear all demo data for this tenant and re-seed
    const tables = [
      'orders', 'order_status_history', 'dishes', 'menu_categories', 'inventory_items',
      'tech_cards', 'staff', 'staff_shifts', 'couriers', 'delivery_zones',
      'promo_codes', 'campaigns', 'discount_rules', 'user_bonuses', 'bonus_transactions',
      'bookings', 'booking_tables', 'review_questions', 'reviews', 'notifications',
      'inventory_transactions', 'batches', 'warehouse_bindings', 'stock_contragents',
      'stop_list_items', 'stop_lists', 'weekly_menu', 'documents', 'packaging'
    ];

    const clearAll = db.transaction(() => {
      for (const table of tables) {
        try { db.prepare(`DELETE FROM "${table}" WHERE tenant_id = ?`).run(tenant_id); } catch (e) {
          try { db.prepare(`DELETE FROM "${table}" WHERE branch_id IN (SELECT id FROM branches WHERE tenant_id = ?)`).run(tenant_id); } catch (e2) {}
        }
      }
    });
    clearAll();

    // Re-seed demo data
    seedDemoData(db, bcrypt, tenant_id);

    db.prepare('UPDATE foodchain_portal_tenants SET demo_data_created_at = datetime(\'now\') WHERE id = ?').run(tenant_id);
    res.json({ message: 'Demo data reset successfully' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/internal/access-mode/:tenantId', (req, res) => {
  try {
    const { key } = req.query;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    const pt = db.prepare('SELECT access_mode, demo_data_created_at, demo_auto_cleanup_days FROM foodchain_portal_tenants WHERE id = ?').get(req.params.tenantId);
    if (!pt) return res.status(404).json({ error: 'Tenant not found' });
    res.json(pt);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/workshops', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM workshops ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/workshops', (req, res) => {
  try {
    const { name, branch_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO workshops (name, branch_id) VALUES (?, ?)').run(name, branch_id || null);
    res.status(201).json({ id: info.lastInsertRowid, name, branch_id: branch_id || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/workshops/:id', (req, res) => {
  try {
    const { name, branch_id, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE workshops SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM workshops WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/workshops/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM workshops WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/modifier-groups', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM modifier_groups ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/modifier-groups', (req, res) => {
  try {
    const { name, description, min_count, max_count } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO modifier_groups (name, description, min_count, max_count) VALUES (?, ?, ?, ?)').run(name, description || null, min_count || 0, max_count || 0);
    res.status(201).json({ id: info.lastInsertRowid, name, description: description || null, min_count: min_count || 0, max_count: max_count || 0 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/modifier-groups/:id', (req, res) => {
  try {
    const { name, description, min_count, max_count } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (min_count !== undefined) { sets.push('min_count = ?'); params.push(min_count); }
    if (max_count !== undefined) { sets.push('max_count = ?'); params.push(max_count); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE modifier_groups SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/modifier-groups/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/modifiers', (req, res) => {
  try {
    const rows = db.prepare('SELECT m.*, mg.name as group_name FROM modifiers m LEFT JOIN modifier_groups mg ON m.group_id = mg.id WHERE m.tenant_id = current_tenant_id() ORDER BY m.name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/modifiers', (req, res) => {
  try {
    const { name, price, group_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO modifiers (name, price, group_id) VALUES (?, ?, ?)').run(name, price || 0, group_id || null);
    res.status(201).json({ id: info.lastInsertRowid, name, price: price || 0, group_id: group_id || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/modifiers/:id', (req, res) => {
  try {
    const { name, price, group_id, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (price !== undefined) { sets.push('price = ?'); params.push(price); }
    if (group_id !== undefined) { sets.push('group_id = ?'); params.push(group_id); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE modifiers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM modifiers WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/modifiers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM modifiers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stop-lists', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM stop_lists ORDER BY until_date DESC').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/stop-lists', (req, res) => {
  try {
    const { item_name, reason, until_date } = req.body;
    if (!item_name) return res.status(400).json({ error: 'Item name required' });
    const info = db.prepare('INSERT INTO stop_lists (item_name, reason, until_date) VALUES (?, ?, ?)').run(item_name, reason || null, until_date || null);
    res.status(201).json({ id: info.lastInsertRowid, item_name, reason: reason || null, until_date: until_date || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/stop-lists/:id', (req, res) => {
  try {
    const { item_name, reason, until_date, is_active } = req.body;
    const sets = []; const params = [];
    if (item_name !== undefined) { sets.push('item_name = ?'); params.push(item_name); }
    if (reason !== undefined) { sets.push('reason = ?'); params.push(reason); }
    if (until_date !== undefined) { sets.push('until_date = ?'); params.push(until_date); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE stop_lists SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM stop_lists WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/stop-lists/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM stop_lists WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/messages', (req, res) => {
  try {
    const { tenant_id, direction, search } = req.query;
    let sql = 'SELECT * FROM messages';
    const conditions = []; const params = [];
    if (tenant_id) { conditions.push('tenant_id = ?'); params.push(tenant_id); }
    if (direction && direction !== 'all') { conditions.push('direction = ?'); params.push(direction); }
    if (search) { conditions.push('(sender LIKE ? OR recipient LIKE ? OR subject LIKE ? OR body LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q, q); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(toCamelCase));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/messages', (req, res) => {
  try {
    const { tenant_id, direction, sender, recipient, subject, body } = req.body;
    const info = db.prepare(
      'INSERT INTO messages (tenant_id, direction, sender, recipient, subject, body) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(tenant_id || 1, direction || 'outgoing', sender || '', recipient || '', subject || '', body || '');
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(msg));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/messages/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/chats', (req, res) => {
  try {
    const { tenant_id, guest_id, guest_name, guest_phone, order_id, table_id } = req.body;
    const info = db.prepare(
      `INSERT INTO chats (tenant_id, guest_id, guest_name, guest_phone, order_id, table_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tenant_id || 1, guest_id || 0, guest_name || '', guest_phone || '', order_id || 0, table_id || 0);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(info.lastInsertRowid);
    const data = chatToCamel(chat);
    io.emit('chat:new', data);
    broadcast(JSON.stringify({ type: 'chat:new', data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/chats', (req, res) => {
  try {
    const { tenant_id, status, waiter_id, search } = req.query;
    let sql = 'SELECT * FROM chats';
    const conditions = ['tenant_id = ?'];
    const params = [tenant_id || 1];
    if (status && status !== 'all') { conditions.push('status = ?'); params.push(status); }
    if (waiter_id && waiter_id !== '0') { conditions.push('assigned_waiter_id = ?'); params.push(waiter_id); }
    if (search) { conditions.push('(guest_name LIKE ? OR guest_phone LIKE ? OR last_message LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q); }
    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(chatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/chats/:id', (req, res) => {
  try {
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chatToCamel(chat));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/chats/:id/assign', (req, res) => {
  try {
    const { waiter_id, waiter_name } = req.body;
    db.prepare('UPDATE chats SET assigned_waiter_id = ?, assigned_waiter_name = ?, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(waiter_id || 0, waiter_name || '', req.params.id);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('chat:assigned', data);
    broadcast(JSON.stringify({ type: 'chat:assigned', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/chats/:id/reopen', (req, res) => {
  try {
    db.prepare('UPDATE chats SET status = \'open\', closed_at = NULL, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(req.params.id);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('chat:reopened', data);
    broadcast(JSON.stringify({ type: 'chat:reopened', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/chats/:id/close', (req, res) => {
  try {
    db.prepare('UPDATE chats SET status = \'closed\', closed_at = datetime(\'now\', \'+3 hours\'), updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(req.params.id);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('chat:closed', data);
    broadcast(JSON.stringify({ type: 'chat:closed', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/chats/:id', (req, res) => {
  try {
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    let adminName = '';
    let adminId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        adminId = payload.id;
        adminName = payload.username || payload.firstName || '';
      } catch {}
    }
    db.prepare('DELETE FROM chat_messages WHERE chat_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chats WHERE id = ?').run(req.params.id);
    logAppAudit(chat.tenant_id || 1, adminId, adminName, 'delete_chat', `Удалён чат #${req.params.id} (гость: ${chat.guest_name || 'неизвестен'})`);
    io.emit('chat:deleted', { id: parseInt(req.params.id) });
    broadcast(JSON.stringify({ type: 'chat:deleted', id: parseInt(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/chats/:id/messages', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(rows.map(chatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/chats/:id/messages', (req, res) => {
  try {
    const { sender_type, sender_id, sender_name, message, file_url } = req.body;
    const info = db.prepare(
      `INSERT INTO chat_messages (chat_id, sender_type, sender_id, sender_name, message, file_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, sender_type || 'guest', sender_id || 0, sender_name || '', message || '', file_url || '');
    const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
    const data = chatToCamel(msg);

    db.prepare(`UPDATE chats SET last_message = ?, last_message_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?`)
      .run(message || '', req.params.id);

    io.emit('chat:message', { chatId: parseInt(req.params.id), message: data });
    broadcast(JSON.stringify({ type: 'chat:message', chatId: parseInt(req.params.id), message: data }));

    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/chats/:chatId/messages/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE chat_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
    io.emit('chat:read', { chatId: parseInt(req.params.chatId), messageId: parseInt(req.params.id) });
    broadcast(JSON.stringify({ type: 'chat:read', chatId: parseInt(req.params.chatId), messageId: parseInt(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/chats/upload', uploadChat.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/chat/${req.file.filename}`, filename: req.file.filename });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/email/settings', (req, res) => {
  try { res.json(emailService.getSettings(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/email/settings', (req, res) => {
  try { res.json(emailService.saveSettings(db, req.body, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/email/test', async (req, res) => {
  try {
    const result = await emailService.testConnection(db, req.body?.tenant_id || 1);
    if (result.success) notifLog('email', 'test', 'Тест SMTP', 'sent');
    else notifLog('email', 'test', 'Тест SMTP', 'failed', result.error);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'Missing to/subject' });
    const result = await emailService.sendMail(db, { to, subject, html }, req.query.tenant_id || 1, notifLog);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/email/track/:logId', (req, res) => {
  try {
    const { logId } = req.params;
    db.prepare('UPDATE email_logs SET opened_at = COALESCE(opened_at, datetime("now")) WHERE id = ?').run(logId);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.end(gif);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/email/unsubscribe', (req, res) => {
  try {
    const { email, tenant } = req.query;
    if (!email) return res.status(400).send('Missing email');
    const t = tenant || 1;
    db.prepare('INSERT OR IGNORE INTO email_unsubscribes (tenant_id, email) VALUES (?, ?)').run(t, email);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<h1>Вы отписались от рассылки</h1><p>Вы больше не будете получать email-уведомления от этого ресторана.</p>');
  } catch (e) { res.status(500).send('Error'); }
});
app.get('/api/email/templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM email_templates WHERE tenant_id = ? ORDER BY is_system DESC, name ASC').all(req.query.tenant_id || 1);
    res.json(templates);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/email/templates', (req, res) => {
  try {
    const { name, subject, body_html, variables } = req.body;
    if (!name || !subject) return res.status(400).json({ error: 'name и subject обязательны' });
    const info = db.prepare('INSERT INTO email_templates (tenant_id, name, subject, body_html, variables, is_system) VALUES (?, ?, ?, ?, ?, 0)').run(
      req.query.tenant_id || 1, name, subject, body_html || '', JSON.stringify(variables || [])
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/email/templates/:id', (req, res) => {
  try {
    const { name, subject, body_html, variables } = req.body;
    db.prepare('UPDATE email_templates SET name = ?, subject = ?, body_html = ?, variables = ? WHERE id = ?').run(
      name, subject, body_html || '', JSON.stringify(variables || []), req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/email/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM email_templates WHERE id = ? AND is_system = 0').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/email/logs', (req, res) => {
  try {
    const { limit, campaign_id } = req.query;
    let sql = 'SELECT * FROM email_logs WHERE tenant_id = ?';
    const params = [req.query.tenant_id || 1];
    if (campaign_id) { sql += ' AND campaign_id = ?'; params.push(campaign_id); }
    sql += ' ORDER BY sent_at DESC LIMIT ?';
    params.push(parseInt(limit) || 100);
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/email/send-campaign', async (req, res) => {
  try {
    const { template_id, recipient_emails, subject_override } = req.body;
    if (!template_id || !recipient_emails?.length) return res.status(400).json({ error: 'template_id и recipient_emails обязательны' });
    const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(template_id);
    if (!template) return res.status(404).json({ error: 'Шаблон не найден' });
    const subject = subject_override || template.subject;
    let sent = 0, failed = 0;
    for (const email of recipient_emails) {
      const result = await emailService.sendMail(db, { to: email, subject, html: template.body_html }, req.query.tenant_id || 1, notifLog);
      if (result.success) sent++; else failed++;
    }
    res.json({ sent, failed, total: recipient_emails.length });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/email/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM email_logs WHERE tenant_id = 1').get();
  const sent = db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE status = 'sent' AND tenant_id = 1").get();
  const failed = db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE status = 'failed' AND tenant_id = 1").get();
  const opened = db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE opened_at IS NOT NULL AND tenant_id = 1").get();
  const recent = db.prepare('SELECT * FROM email_logs WHERE tenant_id = 1 ORDER BY sent_at DESC LIMIT 20').all();
  res.json({ total: total.c, sent: sent.c, failed: failed.c, opened: opened.c, openRate: total.c > 0 ? Math.round(opened.c / total.c * 100) : 0, recent });
});
app.get('/api/notification-logs', (req, res) => {
  try {
    const { channel, limit, offset } = req.query;
    const tenantId = req.query.tenant_id || 1;
    let sql = 'SELECT * FROM notification_logs WHERE tenant_id = ?';
    const params = [tenantId];
    if (channel) { sql += ' AND channel = ?'; params.push(channel); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const lim = Math.min(parseInt(limit) || 50, 500);
    const off = parseInt(offset) || 0;
    params.push(lim, off);
    const logs = db.prepare(sql).all(...params);
    const count = db.prepare('SELECT COUNT(*) as c FROM notification_logs WHERE tenant_id = ?' + (channel ? ' AND channel = ?' : '')).get(...(channel ? [tenantId, channel] : [tenantId]));
    res.json({ logs, total: count.c });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/notification-logs/stats', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const total = db.prepare('SELECT COUNT(*) as c FROM notification_logs WHERE tenant_id = ?').get(tenantId);
    const sent = db.prepare("SELECT COUNT(*) as c FROM notification_logs WHERE status = 'sent' AND tenant_id = ?").get(tenantId);
    const failed = db.prepare("SELECT COUNT(*) as c FROM notification_logs WHERE status = 'failed' AND tenant_id = ?").get(tenantId);
    const byChannel = db.prepare('SELECT channel, COUNT(*) as c FROM notification_logs WHERE tenant_id = ? GROUP BY channel').all(tenantId);
    res.json({ total: total.c, sent: sent.c, failed: failed.c, byChannel });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/device-tokens', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const tokens = db.prepare('SELECT * FROM device_tokens WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
    res.json(tokens);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/device-tokens/register', (req, res) => {
  try {
    const { token, platform, device_info } = req.body;
    const tenantId = req.body.tenant_id || 1;
    if (!token) return res.status(400).json({ error: 'token required' });
    res.json(pushService.registerDeviceToken(db, { tenant_id: tenantId, token, platform, device_info }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/device-tokens/unregister', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    res.json(pushService.unregisterDeviceToken(db, token));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/push-settings', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    res.json(pushService.getSettings(db, tenantId));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/push-settings', (req, res) => {
  try {
    const { api_key, project_id, sender_id, app_id, is_enabled } = req.body;
    const tenantId = req.body.tenant_id || 1;
    res.json(pushService.saveSettings(db, { tenant_id: tenantId, api_key, project_id, sender_id, app_id, is_enabled }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/push-settings/test', async (req, res) => {
  try {
    const tenantId = (req.body && req.body.tenant_id) || 1;
    const result = await pushService.sendTest(db, tenantId);
    if (result.success) notifLog('push', 'test', 'Тестовое push-уведомление', 'sent');
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/push-settings/send', async (req, res) => {
  try {
    const { title, body, data } = req.body;
    const tenantId = req.body.tenant_id || 1;
    if (!title) return res.status(400).json({ error: 'title required' });
    const result = await pushService.sendToAll(db, { title, body, data }, tenantId, notifLog);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/email/templates/:id/preview', (req, res) => {
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  let html = template.body_html || template.body || '';
  const variables = req.body.variables || {};
  for (const [key, val] of Object.entries(variables)) {
    html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  res.json({ subject: template.subject, html });
});
app.get('/api/integrations/:type', (req, res) => { try { const row = db.prepare('SELECT * FROM integration_settings WHERE integration_type = ?').get(req.params.type); res.json(row || { integration_type: req.params.type, settings: '{}', is_enabled: false }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.put('/api/integrations/:type', (req, res) => { try { const { settings, isEnabled } = req.body; const existing = db.prepare('SELECT id FROM integration_settings WHERE integration_type = ?').get(req.params.type); if (existing) { db.prepare('UPDATE integration_settings SET settings = ?, is_enabled = ? WHERE integration_type = ?').run(JSON.stringify(settings || {}), isEnabled ? 1 : 0, req.params.type); } else { db.prepare('INSERT INTO integration_settings (integration_type, settings, is_enabled) VALUES (?, ?, ?)').run(req.params.type, JSON.stringify(settings || {}), isEnabled ? 1 : 0); } res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.get('/api/integrations/1c/export-products', (req, res) => {
  try {
    const items = db.prepare("SELECT id as 'ИдТовара', name as 'Наименование', article as 'Артикул', barcode as 'Штрихкод', base_price as 'Цена', unit as 'Единица', current_stock as 'Остаток' FROM inventory_items WHERE id_1c IS NOT NULL OR article IS NOT NULL").all();
    res.json({ items });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/integrations/egais/mark-product', (req, res) => {
  try {
    const { itemId, alcoholType, beerType } = req.body;
    db.prepare('UPDATE inventory_items SET alcohol_type = ?, beer_type = ? WHERE id = ?').run(alcoholType ? 1 : 0, beerType ? 1 : 0, itemId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).length < 2) return res.json({ orders: [], dishes: [], items: [], clients: [], staff: [], documents: [] });
    const query = `%${q}%`;
    const orders = db.prepare("SELECT id, user_name, user_phone, total, status, created_at FROM orders WHERE user_name LIKE ? OR user_phone LIKE ? OR id LIKE ? LIMIT 10").all(query, query, query);
    const dishes = db.prepare("SELECT id, name, price FROM dishes WHERE name LIKE ? LIMIT 10").all(query);
    const items = db.prepare("SELECT id, name, article, barcode, current_stock FROM inventory_items WHERE name LIKE ? OR article LIKE ? OR barcode LIKE ? LIMIT 10").all(query, query, query);
    const clients = db.prepare("SELECT id, name, phone FROM users WHERE name LIKE ? OR phone LIKE ? LIMIT 10").all(query, query);
    const staff = db.prepare("SELECT id, first_name, last_name, role, phone FROM staff WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? LIMIT 10").all(query, query, query);
    const documents = db.prepare("SELECT id, type, number, status, date FROM documents WHERE number LIKE ? OR note LIKE ? LIMIT 10").all(query, query);
    res.json({ orders, dishes, items, clients, staff, documents });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/couriers', (req, res) => {
  try {
    const couriers = db.prepare(`SELECT s.id, s.first_name, s.last_name, s.phone, s.role, s.is_online, s.photo_url, cl.lat as latitude, cl.lng as longitude, cl.recorded_at as location_updated_at FROM staff s LEFT JOIN courier_locations cl ON cl.staff_id = s.id WHERE s.role = 'courier' AND s.tenant_id = current_tenant_id()`).all();
    res.json(couriers);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/waiter/tables', (req, res) => {
  try {
    const tables = db.prepare('SELECT * FROM booking_tables ORDER BY name').all();
    const now = new Date().toISOString().slice(0, 10);
    const activeOrders = db.prepare("SELECT * FROM orders WHERE status NOT IN ('delivered','closed','cancelled') AND type = 'dine_in'").all();
    const activeChecks = db.prepare("SELECT * FROM dine_in_checks WHERE status = 'open'").all();
    const todaysBookings = db.prepare('SELECT * FROM bookings WHERE date = ? AND status IN (\'confirmed\',\'pending\')').all(now);
    const calls = db.prepare('SELECT * FROM waiter_calls WHERE resolved_at IS NULL').all();

    const result = tables.map(t => {
      const order = activeOrders.find(o => o.table_number === t.id || o.table_id === t.id);
      const check = activeChecks.find(c => c.table_id === t.id);
      const booking = todaysBookings.find(b => b.table_id === t.id);
      const call = calls.find(c => c.table_id === t.id);
      let status = 'free';
      if (check || (order && ['new','confirmed','preparing','ready','served'].includes(order.status))) status = 'occupied';
      if (booking) status = 'reserved';
      if (order && order.status === 'paid') status = 'occupied';
      return {
        id: t.id, name: t.name, capacity: t.capacity, zone: t.zone || '',
        x: t.x, y: t.y, width: t.width, height: t.height, shape: t.shape, color: t.color,
        status, currentOrderId: order?.id || null, currentCheckId: check?.id || null,
        waiterName: check?.waiter_name || order?.waiter_name || null,
        guestCount: check?.guest_count || order?.guest_count || null,
        hasCall: !!call,
      };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/seated', (req, res) => {
  try {
    const { tableId, waiterId, waiterName, guestCount } = req.body;
    if (!tableId || !waiterId) return res.status(400).json({ error: 'tableId and waiterId required' });

    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
    if (!table) return res.status(404).json({ error: 'Стол не найден' });

    const existingCheck = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open'").get(tableId);
    if (existingCheck) return res.status(400).json({ error: 'Стол уже занят' });

    const info = db.prepare('INSERT INTO dine_in_checks (table_id, table_name, waiter_id, waiter_name, guest_count) VALUES (?, ?, ?, ?, ?)')
      .run(tableId, table.name, waiterId, waiterName || '', guestCount || 1);

    broadcast({ type: 'waiter:seated', tableId: Number(tableId), checkId: Number(info.lastInsertRowid) });
    io.emit('waiter:seated', { tableId: Number(tableId), checkId: Number(info.lastInsertRowid), waiterName });

    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(check);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/orders', (req, res) => {
  try {
    const { checkId, tableId, waiterId, waiterName, items, guestCount, comment, type, deliveryName, deliveryPhone, deliveryAddress, deliveryComment, discount } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'items required' });

    const orderType = type || 'dine_in';

    let check;
    if (orderType === 'dine_in') {
      if (!checkId && !tableId) return res.status(400).json({ error: 'checkId or tableId required for dine-in' });
      if (checkId) {
        check = db.prepare("SELECT * FROM dine_in_checks WHERE id = ? AND status = 'open'").get(checkId);
        if (!check) return res.status(404).json({ error: 'Чек не найден или уже закрыт' });
      }
    }

    const itemsJson = JSON.stringify(items.map((i) => ({
      dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity || 1,
      options: i.options || [], comment: i.comment || '', itemStatus: 'pending',
    })));
    const subtotal = items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
    let discountAmount = 0;
    if (discount && discount.value > 0) {
      discountAmount = discount.type === 'percent' ? subtotal * (discount.value / 100) : discount.value;
    }
    const total = Math.max(0, subtotal - discountAmount);
    const tid = tableId || check?.table_id || 0;

    const userPhone = deliveryPhone || '';
    const userName = deliveryName || waiterName || 'Официант';
    const userAddr = deliveryAddress || '';

    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, guest_count, check_id, comment, address, discount)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(waiterId || 0, userName, userPhone, itemsJson, subtotal, total,
        orderType, tid, waiterId || null, waiterName || null, guestCount || check?.guest_count || 1,
        checkId || null, comment || '', userAddr, discountAmount);

    const orderId = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'new', 'Заказ создан официантом');

    if (checkId && orderType === 'dine_in') {
      db.prepare('UPDATE dine_in_checks SET total = total + ?, updated_at = datetime(\'now\') WHERE id = ?').run(total, checkId);
    }

    for (const item of items) {
      db.prepare('INSERT INTO order_item_statuses (order_id, dish_id, status) VALUES (?, ?, ?)').run(orderId, item.dishId, 'pending');
    }

    const order = getOrderFull(orderId);
    io.emit('order:new', order);
    broadcast({ type: 'order:new', orderId });
    res.status(201).json(order);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/waiter/active-checks', (req, res) => {
  try {
    const { waiterId } = req.query;
    let checks;
    if (waiterId) {
      checks = db.prepare("SELECT * FROM dine_in_checks WHERE waiter_id = ? AND status = 'open' ORDER BY created_at DESC").all(waiterId);
    } else {
      checks = db.prepare("SELECT * FROM dine_in_checks WHERE status = 'open' ORDER BY created_at DESC").all();
    }
    const result = checks.map(c => {
      const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled') ORDER BY created_at ASC").all(c.id);
      const ordersFull = orders.map((o) => getOrderFull(o.id));
      return { ...c, orders: ordersFull, total: ordersFull.reduce((s, o) => s + o.total, 0) };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/waiter/check-orders/:checkId', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders WHERE check_id = ? ORDER BY created_at ASC').all(req.params.checkId);
    res.json(orders.map((o) => getOrderFull(o.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/call', (req, res) => {
  try {
    const { tableId, note } = req.body;
    if (!tableId) return res.status(400).json({ error: 'tableId required' });
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
    const info = db.prepare('INSERT INTO waiter_calls (table_id, table_name, note) VALUES (?, ?, ?)').run(tableId, table?.name || '', note || '');
    broadcast({ type: 'waiter:call', tableId: Number(tableId), tableName: table?.name, callId: Number(info.lastInsertRowid) });
    io.emit('waiter:call', { tableId: Number(tableId), tableName: table?.name, callId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: info.lastInsertRowid, tableId, tableName: table?.name });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/call/:id/resolve', (req, res) => {
  try {
    const { resolvedBy } = req.body;
    db.prepare('UPDATE waiter_calls SET resolved_at = datetime(\'now\'), resolved_by = ? WHERE id = ?').run(resolvedBy || null, req.params.id);
    broadcast({ type: 'waiter:call:resolved', callId: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/move-guests', (req, res) => {
  try {
    const { fromTableId, toTableId } = req.body;
    if (!fromTableId || !toTableId) return res.status(400).json({ error: 'fromTableId and toTableId required' });
    const checks = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open'").all(fromTableId);
    for (const check of checks) {
      db.prepare('UPDATE dine_in_checks SET table_id = ?, table_name = (SELECT name FROM booking_tables WHERE id = ?), updated_at = datetime(\'now\') WHERE id = ?')
        .run(toTableId, toTableId, check.id);
      db.prepare('UPDATE orders SET table_number = ?, updated_at = datetime(\'now\') WHERE check_id = ?').run(toTableId, check.id);
    }
    broadcast({ type: 'table:status', fromTableId, toTableId });
    io.emit('waiter:moved', { fromTableId, toTableId });
    res.json({ moved: checks.length });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/split-check/:checkId', (req, res) => {
  try {
    const { orderItemIds } = req.body;
    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(req.params.checkId);
    if (!check) return res.status(404).json({ error: 'Чек не найден' });
    const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled')").all(check.id);
    const moved = [];
    for (const order of orders) {
      const items = JSON.parse(order.items || '[]');
      const splitItems = items.filter((item, idx) => orderItemIds.includes(item.dishId) || orderItemIds.includes(idx));
      if (splitItems.length === 0 || splitItems.length === items.length) continue;
      const remainingItems = items.filter((item, idx) => !(orderItemIds.includes(item.dishId) || orderItemIds.includes(idx)));
      const splitTotal = splitItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
      const remainingTotal = remainingItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
      db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(JSON.stringify(remainingItems), remainingTotal, remainingTotal, order.id);
      const info = db.prepare("INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, check_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)")
        .run(order.user_id, order.user_name, order.user_phone, JSON.stringify(splitItems), splitTotal, splitTotal,
          order.type, order.table_number, order.waiter_id, order.waiter_name, check.id,
          `Разделён из заказа #${order.id}`);
      moved.push(Number(info.lastInsertRowid));
    }
    res.json({ split: moved });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/waiter/table/:id/request-bill', (req, res) => {
  try {
    const tableId = req.params.id;
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
    if (!table) return res.status(404).json({ error: 'Стол не найден' });
    broadcast({ type: 'table:bill:requested', tableId: Number(tableId) });
    io.emit('waiter:bill-requested', { tableId: Number(tableId) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/waiter/table/:id/guests', (req, res) => {
  try {
    const { guestCount } = req.body;
    const check = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").get(req.params.id);
    if (check) {
      db.prepare('UPDATE dine_in_checks SET guest_count = ?, updated_at = datetime(\'now\') WHERE id = ?').run(guestCount || 1, check.id);
    }
    res.json({ success: true, guestCount });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/kitchen/chat', (req, res) => {
  try {
    const { id, from, text, timestamp, orderId } = req.body;
    broadcast({ type: 'kitchen:chat', id, from, text, timestamp, orderId });
    io.emit('kitchen:chat', { id, from, text, timestamp, orderId });
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/kitchen/orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE status IN ('new','confirmed','preparing') AND type IN ('dine_in','delivery','pickup') ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, created_at ASC").all();
    const result = orders.map((o) => {
      const full = getOrderFull(o.id);
      const itemStatuses = db.prepare('SELECT * FROM order_item_statuses WHERE order_id = ?').all(o.id);
      const waitingTime = o.created_at ? Math.floor((Date.now() - new Date(o.created_at + 'Z').getTime()) / 60000) : 0;
      const waitSeconds = o.created_at ? Math.floor((Date.now() - new Date(o.created_at + 'Z').getTime()) / 1000) : 0;

      // Attach tech card instructions to each item
      let items = [];
      try { items = JSON.parse(o.items || '[]'); } catch {}
      const now = Date.now();
      const itemsWithTech = items.map(item => {
        const dishId = item.dishId || item.dish_id;
        if (!dishId) return item;
        const tc = db.prepare('SELECT technology, cooking_time, output, description, step_instructions, step_mode FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1').get(dishId);
        // Priority scoring
        let priorityScore = 0;
        if (tc?.cooking_time) {
          priorityScore = Math.round((waitSeconds / 60) / tc.cooking_time * 100);
          if (waitingTime > tc.cooking_time) {
            priorityScore = Math.min(priorityScore + 30, 100);
          }
        } else {
          priorityScore = Math.min(Math.round(waitSeconds / 60), 100);
        }
        return { ...item, techCard: tc || null, priority_score: Math.min(priorityScore, 100) };
      });

      return { ...full, items: itemsWithTech, itemStatuses, waitingTime };
    });
    // Sort: higher priority first, but keep new orders on top
    result.sort((a, b) => {
      if (a.status === 'new' && b.status !== 'new') return -1;
      if (a.status !== 'new' && b.status === 'new') return 1;
      const aMax = Math.max(...(a.items || []).map(i => i.priority_score || 0));
      const bMax = Math.max(...(b.items || []).map(i => i.priority_score || 0));
      return bMax - aMax;
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/kitchen/orders/:id/accept', (req, res) => {
  try {
    const { chefId } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    db.prepare("UPDATE orders SET status = 'preparing', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'preparing', 'Принят в работу');

    // Update all pending items to preparing
    db.prepare("UPDATE order_item_statuses SET status = 'preparing', started_at = datetime('now'), prepared_by = ? WHERE order_id = ? AND status = 'pending'")
      .run(chefId || null, req.params.id);

    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'preparing' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/kitchen/orders/:id/complete', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (!['new', 'confirmed', 'preparing'].includes(order.status)) return res.status(400).json({ error: 'Заказ уже завершён' });

    db.prepare("UPDATE order_item_statuses SET status = 'ready', completed_at = datetime('now') WHERE order_id = ? AND status != 'ready'").run(req.params.id);
    db.prepare("UPDATE orders SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'ready', 'Заказ готов');

    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'ready' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/kitchen/sous-chef', (req, res) => {
  try {
    const orders = db.prepare("SELECT o.*, (julianday('now') - julianday(o.created_at)) * 86400 as wait_seconds FROM orders o WHERE o.status IN ('confirmed','preparing') AND o.tenant_id = ? ORDER BY o.created_at ASC").all(req.tenant_id || 1);
    const recommendations = [];
    for (const order of orders) {
      const items = JSON.parse(order.items || '[]');
      let maxPriority = 0;
      for (const item of items) {
        const techCard = db.prepare('SELECT cooking_time FROM dish_tech_cards WHERE dish_id = ?').get(item.dish_id || item.dishId);
        const cookTime = techCard?.cooking_time || 10;
        const waitTime = order.wait_seconds || 0;
        const priority = Math.round((waitTime / 60) / cookTime * 100);
        if (priority > maxPriority) maxPriority = priority;
      }
      recommendations.push({ order_id: order.id, table: order.table_id, guest: order.user_name, items_count: items.length, wait_minutes: Math.round((order.wait_seconds || 0) / 60), priority_score: Math.min(maxPriority, 100), suggested_action: maxPriority > 80 ? 'START_NOW' : maxPriority > 50 ? 'SOON' : 'ON_SCHEDULE' });
    }
    recommendations.sort((a, b) => b.priority_score - a.priority_score);
    res.json(recommendations);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/kitchen/step-completions/:orderId/:dishId', (req, res) => {
  try {
    const rows = db.prepare('SELECT step_index, completed_by, completed_at FROM dish_step_completions WHERE order_id = ? AND dish_id = ?').all(req.params.orderId, req.params.dishId);
    res.json(rows.map(r => ({ stepIndex: r.step_index, completedBy: r.completed_by, completedAt: r.completed_at })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/kitchen/step-completions', (req, res) => {
  try {
    const { order_id, dish_id, step_index, completed } = req.body;
    if (completed) {
      db.prepare('INSERT OR IGNORE INTO dish_step_completions (order_id, dish_id, step_index) VALUES (?, ?, ?)').run(order_id, dish_id, step_index);
    } else {
      db.prepare('DELETE FROM dish_step_completions WHERE order_id = ? AND dish_id = ? AND step_index = ?').run(order_id, dish_id, step_index);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/waiter/calls/pending', (req, res) => {
  try {
    const calls = db.prepare('SELECT * FROM waiter_calls WHERE resolved_at IS NULL ORDER BY created_at ASC').all();
    res.json(calls);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/user/language', (req, res) => {
  try {
    const { staffId, language } = req.body;
    if (!staffId) return res.status(400).json({ error: 'staffId is required' });
    if (!['ru', 'en', 'kk'].includes(language)) return res.status(400).json({ error: 'Invalid language. Must be ru, en, or kk' });
    const staff = db.prepare('SELECT id FROM staff WHERE id = ?').get(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    db.prepare('UPDATE staff SET language = ? WHERE id = ?').run(language, staffId);
    res.json({ ok: true, language });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/internal/import-menu', (req, res) => {
  try {
    const { key, tenant_id, items, settings } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    try { db.exec(`ALTER TABLE dishes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN cost REAL DEFAULT 0`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN is_available INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN weight REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN calories REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN proteins REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN fats REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN carbs REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE menu_categories ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE menu_categories ADD COLUMN sort_order INTEGER DEFAULT 0`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE tech_cards ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE tech_card_ingredients ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch (e) {}

    const updateExisting = settings?.update_existing !== false;
    const createCategories = settings?.create_categories !== false;

    const result = { imported: 0, updated: 0, skipped: 0, errors: [], categories_created: 0 };

    const processItems = db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          if (!item.name || !item.name.trim()) {
            result.errors.push({ row: i, error: 'Item name is required' });
            continue;
          }
          if (item.price === undefined || item.price === null) {
            result.errors.push({ row: i, error: 'Price is required' });
            continue;
          }

          let categoryId = null;
          const catName = item.category ? String(item.category).trim() : '';
          if (catName) {
            if (createCategories) {
              let cat = db.prepare('SELECT id FROM menu_categories WHERE name = ? AND tenant_id = ?').get(catName, tenant_id);
              if (!cat) {
                const info = db.prepare('INSERT INTO menu_categories (name, tenant_id) VALUES (?, ?)').run(catName, tenant_id);
                result.categories_created++;
                categoryId = info.lastInsertRowid;
              } else {
                categoryId = cat.id;
              }
            } else {
              const cat = db.prepare('SELECT id FROM menu_categories WHERE name = ? AND tenant_id = ?').get(catName, tenant_id);
              categoryId = cat?.id || null;
            }
          }

          const trimmedName = item.name.trim();
          const existing = db.prepare('SELECT id FROM dishes WHERE name = ? AND tenant_id = ?').get(trimmedName, tenant_id);

          if (existing) {
            if (updateExisting) {
              db.prepare(`UPDATE dishes SET description = ?, price = ?, cost = ?, category_id = ?, weight = ?, unit = ?, calories = ?, proteins = ?, fats = ?, carbs = ?, is_available = ?, is_active = ?, tags = ? WHERE id = ?`).run(
                item.description || null,
                item.price,
                item.cost || null,
                categoryId,
                item.gross_weight || item.net_weight || null,
                item.unit || null,
                item.kcal || null,
                item.proteins || null,
                item.fats || null,
                item.carbs || null,
                item.is_active !== false ? 1 : 0,
                item.is_active !== false ? 1 : 0,
                item.tags ? JSON.stringify(item.tags) : null,
                existing.id
              );
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            db.prepare(`INSERT INTO dishes (name, description, price, cost, category_id, weight, unit, calories, proteins, fats, carbs, is_available, is_active, tags, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
              trimmedName,
              item.description || null,
              item.price,
              item.cost || null,
              categoryId,
              item.gross_weight || item.net_weight || null,
              item.unit || null,
              item.kcal || null,
              item.proteins || null,
              item.fats || null,
              item.carbs || null,
              item.is_active !== false ? 1 : 0,
              item.is_active !== false ? 1 : 0,
              item.tags ? JSON.stringify(item.tags) : null,
              tenant_id
            );
            result.imported++;
          }
        } catch (e) {
          result.errors.push({ row: i, error: safeError(e.message) });
        }
      }
    });

    processItems(items);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/internal/import-tech-cards', (req, res) => {
  try {
    const { key, tenant_id, items, settings } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    try { db.exec(`ALTER TABLE dishes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE menu_categories ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch (e) {}
    db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT, dish_id INTEGER, dish_name TEXT,
      number TEXT, valid_from TEXT, portions REAL, output REAL, technology TEXT,
      fixed_costs REAL, package_weight REAL, cost_price REAL, created_at TEXT,
      tenant_id INTEGER DEFAULT 1
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_card_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tech_card_id INTEGER,
      item_id INTEGER, item_name TEXT, quantity REAL, unit TEXT,
      netto REAL, yield REAL, tenant_id INTEGER DEFAULT 1
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, unit TEXT, current_balance REAL, tenant_id INTEGER DEFAULT 1)`);

    const createIngredients = settings?.create_ingredients !== false;
    const mode = settings?.mode || 'replace';

    const result = { imported: 0, updated: 0, skipped: 0, errors: [], ingredients_created: 0, tech_cards_created: 0 };

    const grouped = {};
    for (const item of items) {
      const dishName = (item.dish_name || '').trim();
      if (!dishName) {
        result.errors.push({ dish: '(empty)', error: 'dish_name is required' });
        continue;
      }
      if (!grouped[dishName]) {
        grouped[dishName] = { dish_name: dishName, valid_from: item.valid_from, portions: item.portions, technology: item.technology, fixed_costs: item.fixed_costs, package_weight: item.package_weight, ingredients: [] };
      }
      if (item.valid_from) grouped[dishName].valid_from = item.valid_from;
      if (item.portions !== undefined) grouped[dishName].portions = item.portions;
      if (item.technology) grouped[dishName].technology = item.technology;
      if (item.fixed_costs !== undefined) grouped[dishName].fixed_costs = item.fixed_costs;
      if (item.package_weight !== undefined) grouped[dishName].package_weight = item.package_weight;
      if (item.name && item.name.trim()) {
        grouped[dishName].ingredients.push({ name: item.name.trim(), quantity: item.quantity, unit: item.unit, netto: item.netto, yield: item.yield });
      }
    }

    const processGroups = db.transaction((grouped) => {
      for (const [dishName, group] of Object.entries(grouped)) {
        try {
          const dish = db.prepare('SELECT id FROM dishes WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND tenant_id = ?').get(dishName, tenant_id);
          if (!dish) {
            result.errors.push({ dish: dishName, error: 'Dish not found' });
            continue;
          }

          let ingredientsCreated = 0;
          for (const ing of group.ingredients) {
            if (!createIngredients) continue;
            const existing = db.prepare('SELECT id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND tenant_id = ?').get(ing.name, tenant_id);
            if (!existing) {
              db.prepare('INSERT INTO inventory_items (name, unit, current_balance, tenant_id) VALUES (?, ?, 0, ?)').run(ing.name, ing.unit || 'шт', tenant_id);
              ingredientsCreated++;
            }
          }
          result.ingredients_created += ingredientsCreated;

          const existingTc = db.prepare('SELECT id FROM dish_tech_cards WHERE dish_id = ? AND tenant_id = ?').get(dish.id, tenant_id);

          if (existingTc) {
            if (mode === 'replace') {
              db.prepare('DELETE FROM dish_tech_card_ingredients WHERE tech_card_id = ?').run(existingTc.id);
              db.prepare('DELETE FROM dish_tech_cards WHERE id = ?').run(existingTc.id);
              result.updated++;
            } else {
              result.skipped++;
              continue;
            }
          }

          const number = `TC-${dish.id}-${Date.now()}`;
          const tcInfo = db.prepare('INSERT INTO dish_tech_cards (dish_id, dish_name, number, valid_from, portions, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime(\'now\'), ?)').run(
            dish.id, dishName, number, group.valid_from || null, group.portions || null, group.technology || null, group.fixed_costs || null, group.package_weight || null, tenant_id
          );
          result.tech_cards_created++;

          const insertIng = db.prepare('INSERT INTO dish_tech_card_ingredients (tech_card_id, item_name, quantity, unit, netto, yield, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
          for (const ing of group.ingredients) {
            const invItem = db.prepare('SELECT id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND tenant_id = ?').get(ing.name, tenant_id);
            insertIng.run(tcInfo.lastInsertRowid, ing.name, ing.quantity || 0, ing.unit || 'шт', ing.netto || null, ing.yield || null, tenant_id);
          }

          result.imported++;
        } catch (e) {
          result.errors.push({ dish: dishName, error: safeError(e.message) });
        }
      }
    });

    processGroups(grouped);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/settings', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1 || 1;
    const row = db.prepare('SELECT settings FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    res.json({ settings: parseAppSettings(row?.settings) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/settings', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) tenantId = 1;
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
    const merged = parseAppSettings(settings);
    const str = JSON.stringify(merged);
    const existing = db.prepare('SELECT id FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    if (existing) {
      db.prepare("UPDATE app_general_settings SET settings = ?, updated_at = datetime('now') WHERE tenant_id = ?").run(str, tenantId);
    } else {
      db.prepare('INSERT INTO app_general_settings (tenant_id, settings) VALUES (?, ?)').run(tenantId, str);
    }
    const payload = jwt.verify(req.headers.authorization.slice(7), JWT_SECRET);
    logAppAudit(tenantId, payload.id, payload.username, 'update_settings', 'Обновлены общие настройки приложения');
    res.json({ settings: merged, message: 'Настройки сохранены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/settings/reset', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const defaults = JSON.parse(DEFAULT_APP_SETTINGS);
    const str = JSON.stringify(defaults);
    const existing = db.prepare('SELECT id FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    if (existing) {
      db.prepare("UPDATE app_general_settings SET settings = ?, updated_at = datetime('now') WHERE tenant_id = ?").run(str, tenantId);
    } else {
      db.prepare('INSERT INTO app_general_settings (tenant_id, settings) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ settings: defaults, message: 'Настройки сброшены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/banners', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const banners = db.prepare('SELECT * FROM app_banners WHERE tenant_id = ? ORDER BY sort_order ASC, created_at DESC').all(tenantId);
    res.json(toCamelCaseArray(banners));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/banners', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { image_url, title, subtitle, link_type, link_value, date_from, date_to, is_active, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url is required' });
    const info = db.prepare('INSERT INTO app_banners (tenant_id, image_url, title, subtitle, link_type, link_value, date_from, date_to, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      tenantId, image_url, title || '', subtitle || '', link_type || '', link_value || '', date_from || null, date_to || null, is_active !== false ? 1 : 0, sort_order || 0
    );
    const banner = db.prepare('SELECT * FROM app_banners WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(banner));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/banners/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_banners WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Баннер не найден' });
    const { image_url, title, subtitle, link_type, link_value, date_from, date_to, is_active, sort_order } = req.body;
    const sets = []; const params = [];
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (subtitle !== undefined) { sets.push('subtitle = ?'); params.push(subtitle); }
    if (link_type !== undefined) { sets.push('link_type = ?'); params.push(link_type); }
    if (link_value !== undefined) { sets.push('link_value = ?'); params.push(link_value); }
    if (date_from !== undefined) { sets.push('date_from = ?'); params.push(date_from || null); }
    if (date_to !== undefined) { sets.push('date_to = ?'); params.push(date_to || null); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id, tenantId);
    db.prepare(`UPDATE app_banners SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const banner = db.prepare('SELECT * FROM app_banners WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(banner));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/app/banners/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_banners WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Баннер не найден' });
    db.prepare('DELETE FROM app_banners WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/banners/reorder', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of {id, sort_order}' });
    const update = db.prepare('UPDATE app_banners SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?');
    for (const item of order) {
      update.run(item.sort_order, item.id, tenantId);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/promotions', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const promotions = db.prepare('SELECT * FROM app_promotions WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
    res.json(toCamelCaseArray(promotions));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/promotions', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { name, description, type, discount_percent, discount_amount, dish_id, category_id, combo_dishes, combo_price, promo_code, min_order_amount, max_uses, date_from, date_to, is_active, show_on_dish, show_as_banner, show_on_page } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const info = db.prepare(`INSERT INTO app_promotions (tenant_id, name, description, type, discount_percent, discount_amount, dish_id, category_id, combo_dishes, combo_price, promo_code, min_order_amount, max_uses, date_from, date_to, is_active, show_on_dish, show_as_banner, show_on_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      tenantId, name, description || '', type, discount_percent || 0, discount_amount || 0, dish_id || null, category_id || null, JSON.stringify(combo_dishes || []), combo_price || 0, promo_code || '', min_order_amount || 0, max_uses || 0, date_from || null, date_to || null, is_active !== false ? 1 : 0, show_on_dish ? 1 : 0, show_as_banner ? 1 : 0, show_on_page ? 1 : 0
    );
    const promotion = db.prepare('SELECT * FROM app_promotions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(promotion));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/promotions/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_promotions WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Акция не найдена' });
    const fields = ['name','description','type','discount_percent','discount_amount','dish_id','category_id','combo_dishes','combo_price','promo_code','min_order_amount','max_uses','date_from','date_to','is_active','show_on_dish','show_as_banner','show_on_page'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        let val = req.body[f];
        if (f === 'combo_dishes') val = JSON.stringify(val || []);
        if (f === 'is_active' || f === 'show_on_dish' || f === 'show_as_banner' || f === 'show_on_page') val = val ? 1 : 0;
        sets.push(`${f} = ?`); params.push(val);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id, tenantId);
    db.prepare(`UPDATE app_promotions SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const promotion = db.prepare('SELECT * FROM app_promotions WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(promotion));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/app/promotions/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_promotions WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Акция не найдена' });
    db.prepare('DELETE FROM app_promotions WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/working-hours', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const hours = db.prepare('SELECT * FROM app_working_hours WHERE tenant_id = ? ORDER BY day_of_week ASC').all(tenantId);
    const specialDays = db.prepare('SELECT * FROM app_special_days WHERE tenant_id = ? ORDER BY date ASC').all(tenantId);
    res.json({ workingHours: toCamelCaseArray(hours), specialDays: toCamelCaseArray(specialDays) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/working-hours', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { hours } = req.body;
    if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours must be an array' });
    db.prepare('DELETE FROM app_working_hours WHERE tenant_id = ?').run(tenantId);
    const insert = db.prepare('INSERT INTO app_working_hours (tenant_id, day_of_week, open_time, close_time, is_closed) VALUES (?, ?, ?, ?, ?)');
    for (const h of hours) {
      insert.run(tenantId, h.day_of_week, h.open_time, h.close_time, h.is_closed ? 1 : 0);
    }
    const result = db.prepare('SELECT * FROM app_working_hours WHERE tenant_id = ? ORDER BY day_of_week ASC').all(tenantId);
    res.json(toCamelCaseArray(result));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/special-days', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { date, is_closed, message } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    const existing = db.prepare('SELECT id FROM app_special_days WHERE tenant_id = ? AND date = ?').get(tenantId, date);
    if (existing) {
      db.prepare('UPDATE app_special_days SET is_closed = ?, message = ? WHERE id = ?').run(is_closed !== false ? 1 : 0, message || '', existing.id);
    } else {
      db.prepare('INSERT INTO app_special_days (tenant_id, date, is_closed, message) VALUES (?, ?, ?, ?)').run(tenantId, date, is_closed !== false ? 1 : 0, message || '');
    }
    const days = db.prepare('SELECT * FROM app_special_days WHERE tenant_id = ? ORDER BY date ASC').all(tenantId);
    res.json(toCamelCaseArray(days));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/app/special-days/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    db.prepare('DELETE FROM app_special_days WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/modifiers', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const groups = db.prepare('SELECT * FROM app_modifier_groups WHERE tenant_id = ? ORDER BY sort_order ASC').all(tenantId);
    const modifiers = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.tenant_id = ? ORDER BY am.sort_order ASC').all(tenantId);
    res.json({ groups: toCamelCaseArray(groups), modifiers: toCamelCaseArray(modifiers) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/modifier-groups', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const info = db.prepare('INSERT INTO app_modifier_groups (tenant_id, name, sort_order) VALUES (?, ?, ?)').run(tenantId, name, sort_order || 0);
    const group = db.prepare('SELECT * FROM app_modifier_groups WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/modifier-groups/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_modifier_groups WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Группа не найдена' });
    const { name, sort_order } = req.body;
    if (name !== undefined) db.prepare('UPDATE app_modifier_groups SET name = ? WHERE id = ?').run(name, req.params.id);
    if (sort_order !== undefined) db.prepare('UPDATE app_modifier_groups SET sort_order = ? WHERE id = ?').run(sort_order, req.params.id);
    const group = db.prepare('SELECT * FROM app_modifier_groups WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/app/modifier-groups/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    db.prepare('UPDATE app_modifiers SET group_id = NULL WHERE group_id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    db.prepare('DELETE FROM app_modifier_groups WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/modifiers', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { group_id, name, price, description, sort_order, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const info = db.prepare('INSERT INTO app_modifiers (tenant_id, group_id, name, price, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      tenantId, group_id || null, name, price || 0, description || '', sort_order || 0, is_active !== false ? 1 : 0
    );
    const modifier = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.id = ? AND am.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(modifier));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/modifiers/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_modifiers WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Модификатор не найден' });
    const { group_id, name, price, description, sort_order, is_active } = req.body;
    const sets = []; const params = [];
    if (group_id !== undefined) { sets.push('group_id = ?'); params.push(group_id || null); }
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (price !== undefined) { sets.push('price = ?'); params.push(price); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id, tenantId);
    db.prepare(`UPDATE app_modifiers SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const modifier = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.id = ? AND am.tenant_id = current_tenant_id()').get(req.params.id);
    res.json(toCamelCase(modifier));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/app/modifiers/:id', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    db.prepare('DELETE FROM app_modifiers WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/visibility', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const categories = db.prepare('SELECT id, name, icon, parent_id, sort_order, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators FROM menu_categories WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY sort_order ASC').all(tenantId);
    res.json(toCamelCaseArray(categories));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/app/visibility/batch', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates must be an array' });
    const update = db.prepare('UPDATE menu_categories SET show_on_site = ?, show_on_app = ?, show_on_kiosk = ?, show_on_waiter = ?, show_on_aggregators = ? WHERE id = ?');
    for (const u of updates) {
      update.run(u.show_on_site ? 1 : 0, u.show_on_app ? 1 : 0, u.show_on_kiosk ? 1 : 0, u.show_on_waiter ? 1 : 0, u.show_on_aggregators ? 1 : 0, u.id);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/app/upload', uploadAppImage.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let tenantId = 'unknown';
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        tenantId = payload.tenantId || payload.tenant_id || 'unknown';
      } catch {}
    }
    const ext = path.extname(req.file.originalname);
    const newName = `${tenantId}_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newName);
    require('fs').renameSync(req.file.path, newPath);
    const url = `/uploads/app/${newName}`;
    res.json({ url, filename: newName });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/public/app-config/:tenantId', (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const settingsRow = db.prepare('SELECT settings FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    const banners = db.prepare('SELECT * FROM app_banners WHERE tenant_id = ? AND is_active = 1 AND (date_from IS NULL OR date_from <= date(\'now\')) AND (date_to IS NULL OR date_to >= date(\'now\')) ORDER BY sort_order ASC').all(tenantId);
    const promotions = db.prepare('SELECT * FROM app_promotions WHERE tenant_id = ? AND is_active = 1 AND (date_from IS NULL OR date_from <= date(\'now\')) AND (date_to IS NULL OR date_to >= date(\'now\')) ORDER BY created_at DESC').all(tenantId);
    const workingHours = db.prepare('SELECT * FROM app_working_hours WHERE tenant_id = ? ORDER BY day_of_week ASC').all(tenantId);
    const specialDays = db.prepare('SELECT * FROM app_special_days WHERE tenant_id = ? AND date >= date(\'now\') ORDER BY date ASC').all(tenantId);
    const modifiers = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.tenant_id = ? AND am.is_active = 1 ORDER BY am.sort_order ASC').all(tenantId);
    const brandingRow = db.prepare('SELECT branding FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    const deliveryZones = db.prepare('SELECT * FROM delivery_zones ORDER BY name ASC').all();
    res.json({
      settings: parseAppSettings(settingsRow?.settings),
      banners: toCamelCaseArray(banners),
      promotions: toCamelCaseArray(promotions),
      workingHours: toCamelCaseArray(workingHours),
      specialDays: toCamelCaseArray(specialDays),
      modifiers: toCamelCaseArray(modifiers),
      branding: parseBranding(brandingRow?.branding),
      deliveryZones: toCamelCaseArray(deliveryZones),
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/app/audit-log', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const logs = db.prepare('SELECT * FROM app_audit_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200').all(tenantId);
    res.json(toCamelCaseArray(logs));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/webhooks/yandex-afisha', (req, res) => {
  try {
    const { external_id, date, time, guests, name, phone, comment, api_key } = req.body;
    const settings = db.prepare('SELECT * FROM yandex_afisha_settings WHERE api_key = ? AND enabled = 1').get(api_key);
    if (!settings) return res.status(403).json({ error: 'Invalid API key' });
    db.prepare('INSERT INTO yandex_afisha_bookings (tenant_id, external_id, date, time, guests, name, phone, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(settings.tenant_id, external_id || '', date, time, guests || 1, name, phone || '', comment || '');
    if (settings.auto_confirm) {
      db.prepare("INSERT INTO bookings (user_name, user_phone, date, time, guest_count, comment, status) VALUES (?, ?, ?, ?, ?, ?, 'confirmed')").run(name, phone || '', date, time, guests || 1, 'Яндекс Афиша');
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/webhooks/telephony/incoming-call', (req, res) => {
  try {
    const { call_id, caller_phone, callee_phone, api_key } = req.body;
    const settings = db.prepare('SELECT * FROM telephony_settings WHERE api_key = ? AND enabled = 1').get(api_key);
    if (!settings) return res.status(403).json({ error: 'Invalid API key' });
    db.prepare("INSERT INTO telephony_call_log (tenant_id, call_id, caller_phone, callee_phone, direction) VALUES (?, ?, ?, ?, 'incoming')").run(settings.tenant_id, call_id || '', caller_phone || '', callee_phone || '');
    const client = db.prepare('SELECT id, name FROM users WHERE phone = ? AND tenant_id = ?').get(caller_phone, settings.tenant_id);
    res.json({ ok: true, client: client ? { id: client.id, name: client.name } : null });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/games', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM games WHERE tenant_id = ? AND enabled = 1').all(req.tenant_id || 1);
    res.json(games);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/games/wheel/play', (req, res) => {
  try {
    const { guest_id, points, prize } = req.body;
    const tid = req.tenant_id || 1;
    if (guest_id) {
      const recent = db.prepare("SELECT created_at FROM game_participations WHERE guest_id = ? AND game_type = 'wheel_of_fortune' AND tenant_id = ? ORDER BY created_at DESC LIMIT 1").get(guest_id, tid);
      if (recent) {
        const diff = (Date.now() - new Date(recent.created_at + 'Z').getTime()) / 3600000;
        const game = db.prepare("SELECT cooldown_hours FROM games WHERE type = 'wheel_of_fortune' AND tenant_id = ? AND enabled = 1").get(tid);
        if (game && diff < game.cooldown_hours) return res.json({ ok: false, message: 'Кулдаун' });
      }
      db.prepare("INSERT INTO game_participations (tenant_id, guest_id, game_type, points, prize) VALUES (?, ?, 'wheel_of_fortune', ?, ?)").run(tid, guest_id, points || 0, prize || '');
      if (points > 0) {
        db.prepare('UPDATE user_bonuses SET balance = COALESCE(balance,0) + ? WHERE user_id = ? AND tenant_id = ?').run(points, guest_id, tid);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/games/quiz/answer', (req, res) => {
  try {
    const { guest_id, score } = req.body;
    const tid = req.tenant_id || 1;
    if (guest_id) {
      db.prepare("INSERT INTO game_participations (tenant_id, guest_id, game_type, points, prize) VALUES (?, ?, 'quiz', ?, ?)").run(tid, guest_id, score || 0, '');
      if (score > 0) {
        db.prepare('UPDATE user_bonuses SET balance = COALESCE(balance,0) + ? WHERE user_id = ? AND tenant_id = ?').run(score, guest_id, tid);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/games/leaderboard', (req, res) => {
  try {
    const top = db.prepare('SELECT gp.guest_id, COALESCE(u.name, "Гость") as guest_name, SUM(gp.points) as total_points FROM game_participations gp LEFT JOIN users u ON gp.guest_id = u.id WHERE gp.tenant_id = ? GROUP BY gp.guest_id ORDER BY total_points DESC LIMIT 10').all(req.tenant_id || 1);
    res.json(top);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/games/challenges', (req, res) => {
  try {
    const guestId = req.query.guest_id;
    if (!guestId) return res.json([]);
    const tid = req.tenant_id || 1;
    const ordersCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND tenant_id = ?').get(guestId, tid).c;
    const reviewsCount = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND tenant_id = ?').get(guestId, tid).c;
    const bonus = db.prepare('SELECT COALESCE(balance,0) as b FROM user_bonuses WHERE user_id = ? AND tenant_id = ?').get(guestId, tid);
    const challenges = [
      { id: 'orders_5', title: 'Постоянный гость', desc: 'Сделайте 5 заказов', icon: '🛵', max: 5, progress: ordersCount },
      { id: 'orders_10', title: 'Завсегдатай', desc: 'Сделайте 10 заказов', icon: '⭐', max: 10, progress: ordersCount },
      { id: 'reviews_3', title: 'Критик', desc: 'Оставьте 3 отзыва', icon: '✍️', max: 3, progress: reviewsCount },
      { id: 'bonus_500', title: 'Бонус-хантер', desc: 'Накопите 500 бонусов', icon: '💰', max: 500, progress: bonus?.b || 0 },
    ];
    res.json(challenges);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/exchange-rates', (req, res) => {
  try {
    const rates = db.prepare('SELECT currency_code, rate, symbol FROM exchange_rates WHERE tenant_id = ?').all(req.tenant_id || 1);
    res.json(rates);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
// ─── Voice AI Waiter: drafts ─────────────────────────────────
const voiceDrafts = new Map();

app.post('/api/waiter/voice/draft', (req, res) => {
  try {
    const { waiterId, waiterName, tableId, tableName } = req.body;
    if (!waiterId) return res.status(400).json({ error: 'waiterId required' });
    const draftId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    voiceDrafts.set(draftId, {
      id: draftId, waiterId, waiterName: waiterName || '',
      tableId: tableId || null, tableName: tableName || '',
      items: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    res.status(201).json({ draftId, draft: voiceDrafts.get(draftId) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/waiter/voice/draft/:draftId/items', (req, res) => {
  try {
    const draft = voiceDrafts.get(req.params.draftId);
    if (!draft) return res.status(404).json({ error: 'Черновик не найден' });
    const { items, tableId, tableName } = req.body;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        draft.items.push({
          name: item.name, quantity: item.quantity || 1,
          modifiers: item.modifiers || [], exclude: item.exclude || [],
          menu_match: item.menu_match || null, found: item.found !== false,
        });
      }
    }
    if (tableId) draft.tableId = tableId;
    if (tableName) draft.tableName = tableName;
    draft.updated_at = new Date().toISOString();
    res.json({ draft });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/waiter/voice/draft/:draftId', (req, res) => {
  try {
    const draft = voiceDrafts.get(req.params.draftId);
    if (!draft) return res.status(404).json({ error: 'Черновик не найден' });
    res.json({ draft });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/waiter/voice/drafts', (req, res) => {
  try {
    const { waiterId } = req.query;
    const all = [...voiceDrafts.values()];
    const filtered = waiterId ? all.filter(d => d.waiterId === Number(waiterId)) : all;
    res.json({ drafts: filtered });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/waiter/voice/draft/:draftId', (req, res) => {
  try {
    const deleted = voiceDrafts.delete(req.params.draftId);
    res.json({ deleted });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/waiter/voice/queue', (req, res) => {
  try {
    const { waiterId } = req.query;
    const all = [...voiceDrafts.values()]
      .filter(d => d.items.length > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const queue = waiterId
      ? all.filter(d => d.waiterId === Number(waiterId)).map((d, i) => ({ ...d, queuePos: i + 1, queueTotal: all.length }))
      : all.map((d, i) => ({ ...d, queuePos: i + 1, queueTotal: all.length }));
    res.json({ queue });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/waiter/voice/confirm', async (req, res) => {
  try {
    const { draftId, waiterId, waiterName } = req.body;
    const draft = voiceDrafts.get(draftId);
    if (!draft) return res.status(404).json({ error: 'Черновик не найден' });
    if (!draft.items.length) return res.status(400).json({ error: 'Черновик пуст' });

    let check;
    const tableId = draft.tableId;
    if (tableId) {
      const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
      if (!table) return res.status(404).json({ error: 'Стол не найден' });
      let existingCheck = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open'").get(tableId);
      if (!existingCheck) {
        const info = db.prepare('INSERT INTO dine_in_checks (table_id, table_name, waiter_id, waiter_name, guest_count) VALUES (?, ?, ?, ?, ?)')
          .run(tableId, draft.tableName || table.name, waiterId || draft.waiterId, waiterName || '', 1);
        existingCheck = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(info.lastInsertRowid);
      }
      check = existingCheck;
    }

    const items = draft.items.map(i => ({
      dishId: i.menu_match?.id || 0, name: i.name, price: i.menu_match?.price || 0,
      quantity: i.quantity || 1, options: [...(i.modifiers || []), ...(i.exclude || []).map(e => `без ${e}`)],
      comment: '', itemStatus: 'pending',
    }));
    const itemsJson = JSON.stringify(items);
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, guest_count, check_id, comment)
      VALUES (?, ?, ?, ?, ?, ?, 'dine_in', 'new', ?, ?, ?, ?, ?, ?)`)
      .run(waiterId || draft.waiterId || 0, waiterName || 'Официант', '', itemsJson, subtotal, subtotal,
        tableId || 0, waiterId || draft.waiterId || null, waiterName || null, 1,
        check?.id || null, 'Голосовой заказ');

    const orderId = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'new', 'Голосовой заказ');

    if (check) {
      db.prepare('UPDATE dine_in_checks SET total = total + ?, updated_at = datetime(\'now\') WHERE id = ?').run(subtotal, check.id);
    }

    for (const item of items) {
      db.prepare('INSERT INTO order_item_statuses (order_id, dish_id, status) VALUES (?, ?, ?)').run(orderId, item.dishId, 'pending');
    }

    voiceDrafts.delete(draftId);

    const order = getOrderFull(orderId);
    io.emit('order:new', order);
    broadcast({ type: 'order:new', orderId });
    res.status(201).json({ order, orderId });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/waiter/voice/pay', (req, res) => {
  try {
    const { checkId, paymentMethod } = req.body;
    if (!checkId) return res.status(400).json({ error: 'checkId required' });
    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(checkId);
    if (!check) return res.status(404).json({ error: 'Чек не найден' });

    const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled')").all(checkId);
    if (!orders.length) return res.status(404).json({ error: 'Нет активных заказов в чеке' });

    for (const order of orders) {
      db.prepare("UPDATE orders SET payment_method = ?, is_paid = 1, status = 'paid', updated_at = datetime('now') WHERE id = ?")
        .run(paymentMethod || 'cash', order.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(order.id, 'paid', 'Оплачено голосом');
    }

    db.prepare("UPDATE dine_in_checks SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(checkId);

    const updated = db.prepare('SELECT * FROM orders WHERE check_id = ?').all(checkId);
    updated.forEach(o => io.emit('order:update', o));
    res.json({ orders: updated, checkId });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/waiter/voice/close', (req, res) => {
  try {
    const { checkId } = req.body;
    if (!checkId) return res.status(400).json({ error: 'checkId required' });
    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(checkId);
    if (!check) return res.status(404).json({ error: 'Чек не найден' });

    const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled')").all(checkId);
    for (const order of orders) {
      db.prepare("UPDATE orders SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(order.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(order.id, 'closed', 'Закрыт голосом');
    }
    db.prepare("UPDATE dine_in_checks SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(checkId);

    const updated = db.prepare('SELECT * FROM orders WHERE check_id = ?').all(checkId);
    updated.forEach(o => io.emit('order:update', o));
    res.json({ orders: updated, checkId });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/waiter/voice/cancel', (req, res) => {
  try {
    const { orderId, draftId } = req.body;
    if (draftId) {
      voiceDrafts.delete(draftId);
      return res.json({ cancelled: true, type: 'draft' });
    }
    if (!orderId) return res.status(400).json({ error: 'orderId or draftId required' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(orderId);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'cancelled', 'Отменён голосом');

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    io.emit('order:update', updated);
    res.json({ order: updated, cancelled: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/waiter/voice/refund', (req, res) => {
  try {
    const { checkId, reason } = req.body;
    if (!checkId) return res.status(400).json({ error: 'checkId required' });
    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(checkId);
    if (!check) return res.status(404).json({ error: 'Чек не найден' });

    const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled','refunded')").all(checkId);
    for (const order of orders) {
      db.prepare("UPDATE orders SET status = 'refunded', is_paid = 0, updated_at = datetime('now') WHERE id = ?").run(order.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(order.id, 'refunded', reason || 'Возврат голосом');
    }
    db.prepare("UPDATE dine_in_checks SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(checkId);

    const updated = db.prepare('SELECT * FROM orders WHERE check_id = ?').all(checkId);
    updated.forEach(o => io.emit('order:update', o));
    res.json({ orders: updated, refunded: true, checkId });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/v1', (req, res) => res.json({ name: 'FoodChain API', version: '1.0', status: 'ok' }));
};