
module.exports = function(app, db, config) {
  const { io, safeError, toCamelCase, toCamelCaseArray, getLoyaltySettings, getGuestBonusInfo } = config;

app.get('/api/promocodes', (req, res) => {
  try {
    const codes = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(codes));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/promocodes', (req, res) => {
  try {
    const { code, type, value, min_order, max_uses, expires_at, is_active } = req.body;
    if (!code || !type || value === undefined) return res.status(400).json({ error: 'Код, тип и значение обязательны' });
    const info = db.prepare('INSERT INTO promo_codes (code, type, value, min_order, max_uses, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      code.toUpperCase(), type, value, min_order || 0, max_uses || null, expires_at || null, is_active !== undefined ? (is_active ? 1 : 0) : 1
    );
    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(promo));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/promocodes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Промокод не найден' });
    const { code, type, value, min_order, max_uses, expires_at, is_active } = req.body;
    const sets = []; const params = [];
    if (code !== undefined) { sets.push('code = ?'); params.push(code.toUpperCase()); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (value !== undefined) { sets.push('value = ?'); params.push(value); }
    if (min_order !== undefined) { sets.push('min_order = ?'); params.push(min_order); }
    if (max_uses !== undefined) { sets.push('max_uses = ?'); params.push(max_uses); }
    if (expires_at !== undefined) { sets.push('expires_at = ?'); params.push(expires_at); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE promo_codes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(promo));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/promocodes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Промокод не найден' });
    db.prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/marketing/analytics', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
    const activeToday = db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM orders WHERE date(created_at) = date('now')").get().cnt;
    const ordersToday = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE date(created_at) = date('now')").get().cnt;
    const conversionRate = totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(2) : 0;
    res.json({ totalUsers, totalOrders, conversionRate: Number(conversionRate), activeToday, ordersToday });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/discounts', (req, res) => {
  try {
    const discounts = db.prepare('SELECT * FROM discount_rules ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(discounts));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/discounts', (req, res) => {
  try {
    const { name, type, value, targetType, targetId, minOrder, maxDiscount, activeDays, startsAt, endsAt, maxUses } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const info = db.prepare(`INSERT INTO discount_rules (name, type, value, target_type, target_id, min_order, max_discount, active_days, starts_at, ends_at, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name, type || 'percent', value || 0, targetType || 'all', targetId || null, minOrder || 0, maxDiscount || null,
      activeDays || null, startsAt || null, endsAt || null, maxUses || 0
    );
    const d = db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(d));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/discounts/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Скидка не найдена' });
    const { name, type, value, targetType, targetId, minOrder, maxDiscount, activeDays, startsAt, endsAt, maxUses, isActive } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (value !== undefined) { sets.push('value = ?'); params.push(value); }
    if (targetType !== undefined) { sets.push('target_type = ?'); params.push(targetType); }
    if (targetId !== undefined) { sets.push('target_id = ?'); params.push(targetId); }
    if (minOrder !== undefined) { sets.push('min_order = ?'); params.push(minOrder); }
    if (maxDiscount !== undefined) { sets.push('max_discount = ?'); params.push(maxDiscount); }
    if (activeDays !== undefined) { sets.push('active_days = ?'); params.push(activeDays); }
    if (startsAt !== undefined) { sets.push('starts_at = ?'); params.push(startsAt); }
    if (endsAt !== undefined) { sets.push('ends_at = ?'); params.push(endsAt); }
    if (maxUses !== undefined) { sets.push('max_uses = ?'); params.push(maxUses); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    params.push(req.params.id);
    db.prepare(`UPDATE discount_rules SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(toCamelCase(db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(req.params.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/discounts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM discount_rules WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/loyalty/guest/:userId', (req, res) => {
  try {
    res.json(getGuestBonusInfo(req.params.userId));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/loyalty/guest/:userId/transactions', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const txs = db.prepare('SELECT bt.* FROM bonus_transactions bt WHERE bt.user_id = ? ORDER BY bt.created_at DESC LIMIT ? OFFSET ?').all(req.params.userId, limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM bonus_transactions WHERE user_id = ?').get(req.params.userId);
    res.json({ transactions: toCamelCaseArray(txs), total: total.count, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/loyalty/settings', (req, res) => {
  try {
    res.json(getLoyaltySettings());
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/loyalty/calculate-discount', (req, res) => {
  try {
    const { userId, orderTotal } = req.body;
    if (!userId || !orderTotal) return res.status(400).json({ error: 'userId и orderTotal обязательны' });
    const info = getGuestBonusInfo(userId);
    const maxWriteOff = orderTotal * (info.maxWriteOffPercent / 100);
    const availableBonus = info.balance;
    const maxDiscount = Math.min(availableBonus, maxWriteOff);
    res.json({ availableBonus, maxWriteOff, maxDiscount, canUseBonuses: availableBonus > 0 && maxDiscount > 0 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/loyalty/spend', (req, res) => {
  try {
    const { userId, amount, orderId, description } = req.body;
    if (!userId || !amount || !orderId) return res.status(400).json({ error: 'userId, amount и orderId обязательны' });
    const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
    if (!bonus) return res.status(400).json({ error: 'Бонусный счёт не найден' });
    if (bonus.balance < amount) return res.status(400).json({ error: 'Недостаточно бонусов' });
    db.prepare('UPDATE user_bonuses SET balance = balance - ?, lifetime_spent = lifetime_spent + ? WHERE id = ?').run(amount, amount, bonus.id);
    db.prepare('UPDATE users SET bonus_balance = bonus_balance - ? WHERE id = ?').run(amount, userId);
    db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, bonus.id, 'spend', amount, description || 'Списание за заказ', 'order', orderId);
    res.json({ success: true, newBalance: bonus.balance - amount });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/bonuses', (req, res) => {
  try {
    const bonuses = db.prepare('SELECT ub.*, u.phone as user_phone FROM user_bonuses ub LEFT JOIN users u ON ub.user_id = u.id WHERE ub.tenant_id = current_tenant_id() ORDER BY ub.created_at DESC').all();
    res.json(toCamelCaseArray(bonuses));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/bonuses/transactions', (req, res) => {
  try {
    const txs = db.prepare('SELECT bt.*, u.phone as user_phone FROM bonus_transactions bt LEFT JOIN users u ON bt.user_id = u.id WHERE bt.tenant_id = current_tenant_id() ORDER BY bt.created_at DESC LIMIT 100').all();
    res.json(toCamelCaseArray(txs));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/bonuses/accrue', (req, res) => {
  try {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'user_id и amount обязательны' });
    let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(user_id);
    if (!bonus) {
      const info = db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, 0, 0)').run(user_id);
      bonus = db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(info.lastInsertRowid);
    }
    db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(amount, amount, bonus.id);
    db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description) VALUES (?, ?, ?, ?, ?)').run(user_id, bonus.id, 'earned', amount, description || 'Начисление бонусов');
    res.json(toCamelCase(db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(bonus.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/certificates', (req, res) => {
  try {
    const certs = db.prepare('SELECT * FROM certificates ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(certs));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/certificates', (req, res) => {
  try {
    const { code, amount, type, recipientName, recipientPhone, message, expiresAt } = req.body;
    if (!code || !amount) return res.status(400).json({ error: 'Код и сумма обязательны' });
    const existing = db.prepare('SELECT id FROM certificates WHERE code = ?').get(code);
    if (existing) return res.status(409).json({ error: 'Сертификат с таким кодом уже существует' });
    const info = db.prepare('INSERT INTO certificates (code, amount, balance, type, recipient_name, recipient_phone, message, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      code, amount, amount, type || 'gift', recipientName || null, recipientPhone || null, message || null, expiresAt || null
    );
    const c = db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(c));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/certificates/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сертификат не найден' });
    const { amount, balance, isActive, recipientName, recipientPhone, message, expiresAt } = req.body;
    const sets = []; const params = [];
    if (amount !== undefined) { sets.push('amount = ?'); params.push(amount); }
    if (balance !== undefined) { sets.push('balance = ?'); params.push(balance); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (recipientName !== undefined) { sets.push('recipient_name = ?'); params.push(recipientName); }
    if (recipientPhone !== undefined) { sets.push('recipient_phone = ?'); params.push(recipientPhone); }
    if (message !== undefined) { sets.push('message = ?'); params.push(message); }
    if (expiresAt !== undefined) { sets.push('expires_at = ?'); params.push(expiresAt); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    params.push(req.params.id);
    db.prepare(`UPDATE certificates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(toCamelCase(db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/certificates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM certificates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/loyalty-levels', (req, res) => { try { res.json(db.prepare('SELECT * FROM loyalty_levels ORDER BY min_points').all()); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.post('/api/loyalty-levels', (req, res) => { try { const { name, minPoints, discountPercent, bonusMultiplier } = req.body; const info = db.prepare('INSERT INTO loyalty_levels (name, min_points, discount_percent, bonus_multiplier) VALUES (?, ?, ?, ?)').run(name, minPoints || 0, discountPercent || 0, bonusMultiplier || 1); res.status(201).json({ id: info.lastInsertRowid }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.put('/api/loyalty-levels/:id', (req, res) => { try { const b = req.body; const s=[];const v=[]; if(b.name!==undefined){s.push('name=?');v.push(b.name)} if(b.minPoints!==undefined){s.push('min_points=?');v.push(b.minPoints)} if(b.discountPercent!==undefined){s.push('discount_percent=?');v.push(b.discountPercent)} if(b.bonusMultiplier!==undefined){s.push('bonus_multiplier=?');v.push(b.bonusMultiplier)} if(b.isActive!==undefined){s.push('is_active=?');v.push(b.isActive?1:0)} if(s.length){v.push(req.params.id);db.prepare(`UPDATE loyalty_levels SET ${s.join(',')} WHERE id=?`).run(...v)} res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.delete('/api/loyalty-levels/:id', (req, res) => { try { db.prepare('DELETE FROM loyalty_levels WHERE id=?').run(req.params.id); res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.get('/api/kpi-targets', (req, res) => { try { res.json(db.prepare('SELECT kt.*, s.first_name||\' \'||s.last_name as staff_name FROM kpi_targets kt LEFT JOIN staff s ON kt.staff_id = s.id WHERE kt.tenant_id = current_tenant_id() ORDER BY kt.period, kt.target_name').all()); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.post('/api/kpi-targets', (req, res) => { try { const { staffId, role, targetName, targetValue, period } = req.body; const info = db.prepare('INSERT INTO kpi_targets (staff_id, role, target_name, target_value, period) VALUES (?, ?, ?, ?, ?)').run(staffId || null, role || '', targetName, targetValue || 0, period || 'month'); res.status(201).json({ id: info.lastInsertRowid }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.put('/api/kpi-targets/:id', (req, res) => { try { const b = req.body; const s=[];const v=[]; if(b.targetName!==undefined){s.push('target_name=?');v.push(b.targetName)} if(b.targetValue!==undefined){s.push('target_value=?');v.push(b.targetValue)} if(b.period!==undefined){s.push('period=?');v.push(b.period)} if(s.length){v.push(req.params.id);db.prepare(`UPDATE kpi_targets SET ${s.join(',')} WHERE id=?`).run(...v)} res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.delete('/api/kpi-targets/:id', (req, res) => { try { db.prepare('DELETE FROM kpi_targets WHERE id=?').run(req.params.id); res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.get('/api/kpi-results/:staffId', (req, res) => { try { res.json(db.prepare('SELECT kr.*, kt.target_name FROM kpi_results kr LEFT JOIN kpi_targets kt ON kr.target_id = kt.id WHERE kr.staff_id = ? AND kr.tenant_id = current_tenant_id() ORDER BY kr.period_start DESC').all(req.params.staffId)); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
};