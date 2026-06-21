
module.exports = function(app, db, config) {
  const { io, safeError, toCamelCase, toCamelCaseArray } = config;

app.get('/api/users', (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  const users = db.prepare(sql).all(...params);
  const result = users.map(u => {
    const spent = db.prepare("SELECT COALESCE(SUM(total), 0) as spent FROM orders WHERE user_id = ? AND status = 'delivered'").get(u.id);
    const visits = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?').get(u.id);
    const lastOrder = db.prepare('SELECT created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC').get(u.id);
    return toCamelCase({ ...u, totalSpent: spent.spent, visitsCount: visits.cnt, lastVisitAt: lastOrder?.created_at || u.created_at, bonusBalance: u.bonus_balance || 0, loyaltyLevel: u.loyalty_level || 'новичок' });
  });
  res.json(result);
});
app.get('/api/reviews', (req, res) => {
  const { order_id } = req.query;
  let sql = 'SELECT * FROM reviews WHERE 1=1';
  const params = [];
  if (order_id) { sql += ' AND order_id = ?'; params.push(Number(order_id)); }
  sql += ' ORDER BY created_at DESC';
  const reviews = db.prepare(sql).all(...params);
  res.json(toCamelCaseArray(reviews));
});
app.post('/api/reviews', (req, res) => {
  const { order_id, user_id, user_name, dish_name, rating, text, courier_id } = req.body;
  if (!order_id || !user_id || !rating || !text) return res.status(400).json({ error: 'Все поля обязательны' });
  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(order_id);
  if (existing) return res.status(409).json({ error: 'Отзыв на этот заказ уже есть' });
  const info = db.prepare('INSERT INTO reviews (order_id, user_id, user_name, dish_name, rating, text) VALUES (?, ?, ?, ?, ?, ?)').run(order_id, user_id, user_name, dish_name || '', rating, text);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);

  if (courier_id) {
    const avg = db.prepare('SELECT COALESCE(AVG(r.rating), 0) as avg FROM reviews r JOIN orders o ON r.order_id = o.id WHERE o.courier_id = ? AND o.tenant_id = current_tenant_id()').get(courier_id);
    const count = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE courier_id = ? AND status = 'delivered'").get(courier_id);
    db.prepare('UPDATE couriers SET avg_rating = ?, total_deliveries = ? WHERE id = ?').run(avg.avg, count.cnt, courier_id);
  }

  io.emit('review:new', toCamelCase(review));
  res.status(201).json(toCamelCase(review));
});
app.patch('/api/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.get('/api/clients', (req, res) => {
  try {
    const { search, tenant_id } = req.query;
    let sql = 'SELECT * FROM users WHERE role = ?';
    const params = ['guest'];
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY created_at DESC';
    const clients = db.prepare(sql).all(...params);
    const result = clients.map(c => {
      const stats = db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as spent FROM orders WHERE user_id = ?").get(c.id);
      const lastOrder = db.prepare("SELECT address, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC").get(c.id);
      const note = db.prepare("SELECT note FROM user_notes WHERE user_id = ? ORDER BY created_at DESC").get(c.id);
      return toCamelCase({ ...c, ordersCount: stats.cnt, totalSpent: stats.spent, lastAddress: lastOrder?.address || null, lastVisitAt: lastOrder?.created_at || c.created_at, note: note?.note || null });
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/clients/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    const stats = db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as spent FROM orders WHERE user_id = ?").get(client.id);
    const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(client.id);
    const note = db.prepare("SELECT note FROM user_notes WHERE user_id = ? ORDER BY created_at DESC").get(client.id);
    res.json(toCamelCase({ ...client, ordersCount: stats.cnt, totalSpent: stats.spent, orders: orders.map(toCamelCase), note: note?.note || null }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/clients/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Клиент не найден' });
    const { name, phone, email, note } = req.body;
    if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.params.id);
    if (phone !== undefined) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.params.id);
    if (email !== undefined) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.params.id);
    if (note !== undefined) {
      const existingNote = db.prepare("SELECT id FROM user_notes WHERE user_id = ? ORDER BY created_at DESC").get(req.params.id);
      if (existingNote) db.prepare('UPDATE user_notes SET note = ? WHERE id = ?').run(note, existingNote.id);
      else db.prepare('INSERT INTO user_notes (user_id, note) VALUES (?, ?)').run(req.params.id, note);
    }
    const client = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(client));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/client-groups', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM client_groups WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY name';
    const groups = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(groups));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/client-groups', (req, res) => {
  try {
    const { tenant_id, name, discount, description } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: 'tenant_id and name are required' });
    const info = db.prepare('INSERT INTO client_groups (tenant_id, name, discount, description) VALUES (?, ?, ?, ?)')
      .run(tenant_id, name, discount || 0, description || null);
    const group = db.prepare('SELECT * FROM client_groups WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/client-groups/:id', (req, res) => {
  try {
    const { name, discount, description } = req.body;
    if (name !== undefined) db.prepare('UPDATE client_groups SET name = ? WHERE id = ?').run(name, req.params.id);
    if (discount !== undefined) db.prepare('UPDATE client_groups SET discount = ? WHERE id = ?').run(discount, req.params.id);
    if (description !== undefined) db.prepare('UPDATE client_groups SET description = ? WHERE id = ?').run(description, req.params.id);
    const group = db.prepare('SELECT * FROM client_groups WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/client-groups/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM client_groups WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/review-questions', (req, res) => {
  try {
    const { tenant_id, review_id } = req.query;
    let sql = 'SELECT rq.*, r.user_name as review_user_name FROM review_questions rq LEFT JOIN reviews r ON r.id = rq.review_id WHERE r.tenant_id = current_tenant_id()';
    const params = [];
    if (tenant_id) { sql += ' AND rq.tenant_id = ?'; params.push(Number(tenant_id)); }
    if (review_id) { sql += ' AND rq.review_id = ?'; params.push(Number(review_id)); }
    sql += ' ORDER BY rq.created_at DESC';
    const items = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(items));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/review-questions', (req, res) => {
  try {
    const { review_id, tenant_id, question } = req.body;
    if (!review_id || !question) return res.status(400).json({ error: 'review_id and question are required' });
    const info = db.prepare('INSERT INTO review_questions (review_id, tenant_id, question) VALUES (?, ?, ?)')
      .run(review_id, tenant_id || 1, question);
    const item = db.prepare('SELECT * FROM review_questions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/review-questions/:id/answer', (req, res) => {
  try {
    const { answer } = req.body;
    db.prepare('UPDATE review_questions SET answer = ? WHERE id = ?').run(answer || '', req.params.id);
    const item = db.prepare('SELECT * FROM review_questions WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/guests/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json([]);
    const guests = db.prepare("SELECT id, name, phone FROM users WHERE role = 'guest' AND (name LIKE ? OR phone LIKE ?) LIMIT 10").all(`%${q}%`, `%${q}%`);
    res.json(guests);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/reviews/all', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = `
      SELECT r.*, u.phone as user_phone, o.items as order_items, o.total as order_total
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE 1=1`;
    const params = [];
    if (tenant_id) { sql += ' AND r.tenant_id = ?'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY r.created_at DESC';
    const reviews = db.prepare(sql).all(...params);
    const result = reviews.map(r => {
      let items = [];
      try { if (r.order_items) items = JSON.parse(r.order_items); } catch (e) {}
      return toCamelCase({ ...r, orderItems: items });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/reviews/:id/reply', (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Текст ответа обязателен' });
    const existing = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Отзыв не найден' });
    db.prepare('UPDATE reviews SET reply = ? WHERE id = ?').run(reply, req.params.id);
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(review));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/reviews/photos', (req, res) => {
  try {
    const photos = db.prepare('SELECT * FROM guest_photos ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(photos));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/notifications/send', (req, res) => {
  try {
    const { title, body, segment, user_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Заголовок обязателен' });
    if (segment === 'all' || !segment) {
      const users = db.prepare('SELECT id FROM users').all();
      for (const u of users) {
        db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(u.id, title, body || '');
      }
    } else if (segment === 'user_group' && user_id) {
      db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(user_id, title, body || '');
    }
    io.emit('notification:push', { title, body, segment });
    res.status(201).json({ ok: true, title, body, segment });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/guests/segments', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const withOrders = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM orders').get().c;
  const vip = db.prepare("SELECT COUNT(*) as c FROM users WHERE total_spent > 5000").get().c;
  const newUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE julianday('now') - julianday(created_at) < 30").get().c;
  const inactive = db.prepare("SELECT COUNT(*) as c FROM users WHERE julianday('now') - julianday(last_visit_at) > 90").get().c;
  res.json({ total, withOrders, vip, newUsers, inactive });
});
app.post('/api/notifications/push', (req, res) => {
  try {
    const { title, body, user_ids } = req.body;
    res.json({ ok: true, sent: user_ids?.length || 0 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};