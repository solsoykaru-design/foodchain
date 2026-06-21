
module.exports = function(app, db, config) {
  const { safeError, toCamelCase } = config;

app.get('/api/bookings', (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    if (date) { sql += ' AND date = ?'; params.push(date); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY date DESC, time DESC';
    const bookings = db.prepare(sql).all(...params);
    const result = bookings.map(b => {
      let tableName = null;
      if (b.table_id) {
        const t = db.prepare('SELECT name FROM booking_tables WHERE id = ?').get(b.table_id);
        if (t) tableName = t.name;
      }
      return toCamelCase({ ...b, tableName });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/bookings', (req, res) => {
  try {
    const { user_id, user_name, user_phone, table_id, date, time, duration, guest_count, deposit, comment } = req.body;
    if (!user_name || !user_phone || !date || !time) return res.status(400).json({ error: 'Имя, телефон, дата и время обязательны' });
    const info = db.prepare('INSERT INTO bookings (user_id, user_name, user_phone, table_id, date, time, duration, guest_count, deposit, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      user_id || null, user_name, user_phone, table_id || null, date, time, duration || 120, guest_count || null, deposit || 0, comment || ''
    );
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(booking));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.patch('/api/bookings/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['confirmed', 'cancelled', 'completed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `Недопустимый статус. Допустимо: ${allowed.join(', ')}` });
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Бронь не найдена' });
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(booking));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Бронь не найдена' });
    db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
};