
module.exports = function(app, db, config) {
  const { io, broadcast, safeError, toCamelCase } = config;

app.put('/api/couriers/:id/location', (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    // Update both possible courier_locations table schemas
    try { db.prepare(`INSERT INTO courier_locations (staff_id, lat, lng) VALUES (?, ?, ?)`).run(req.params.id, latitude, longitude); } catch (e1) {
      try { db.prepare(`INSERT INTO courier_locations (courier_id, latitude, longitude) VALUES (?, ?, ?) ON CONFLICT(courier_id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, updated_at = datetime('now')`).run(req.params.id, latitude, longitude); } catch (e2) {}
    }
    
    const data = { type: 'courier:location', courierId: Number(req.params.id), latitude, longitude, updatedAt: new Date().toISOString() };
    broadcast(data);
    io.emit('courier:location', data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/returning-couriers', (req, res) => {
  try {
    const rows = db.prepare(`SELECT id, courier_id, courier_name, return_distance_km, return_duration_min, return_eta, return_courier_lat, return_courier_lng, return_route_polyline, is_returning FROM orders WHERE is_returning = 1 AND status = 'delivered'`).all();
    res.json(rows.map(r => ({ orderId: r.id, courierId: r.courier_id, courierName: r.courier_name, distanceKm: r.return_distance_km, durationMin: r.return_duration_min, eta: r.return_eta, lat: r.return_courier_lat, lng: r.return_courier_lng, polyline: r.return_route_polyline || '' })));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/couriers/:id/availability', (req, res) => {
  const { is_available } = req.body;
  db.prepare('UPDATE couriers SET is_available = ? WHERE id = ?').run(is_available ? 1 : 0, req.params.id);
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(req.params.id);
  res.json(toCamelCase(courier));
});
app.patch('/api/couriers/:id', (req, res) => {
  const { is_available, name, phone } = req.body;
  const sets = []; const params = [];
  if (is_available !== undefined) { sets.push('is_available = ?'); params.push(is_available ? 1 : 0); }
  if (name) { sets.push('name = ?'); params.push(name); }
  if (phone) { sets.push('phone = ?'); params.push(phone); }
  if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
  params.push(req.params.id);
  db.prepare(`UPDATE couriers SET ${sets.join(', ')}, avg_rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r JOIN orders o ON r.order_id = o.id WHERE o.courier_id = ? AND o.tenant_id = current_tenant_id()) WHERE id = ?`).run(...params, req.params.id);
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(req.params.id);
  res.json(toCamelCase(courier));
});
app.get('/api/courier/profile/:id', (req, res) => {
  try {
    const courier = db.prepare("SELECT * FROM staff WHERE id = ? AND role = 'courier'").get(req.params.id);
    if (!courier) return res.status(404).json({ error: 'Курьер не найден' });
    const today = new Date().toISOString().split('T')[0];
      const deliveredToday = db.prepare("SELECT COUNT(*) as cnt FROM orders o JOIN staff s ON o.courier_name = s.first_name || ' ' || COALESCE(s.last_name, '') WHERE s.id = ? AND o.status = 'delivered' AND date(o.updated_at) = ? AND o.tenant_id = current_tenant_id()").get(req.params.id, today);
    const ordersCount = deliveredToday?.cnt || 0;
    // Calculate km from locations
    const locs = db.prepare("SELECT lat, lng FROM courier_locations WHERE staff_id = ? AND date(recorded_at) = ? ORDER BY recorded_at ASC").all(req.params.id, today);
    let kmToday = 0;
    for (let i = 1; i < locs.length; i++) {
      const dlat = (locs[i].lat - locs[i-1].lat) * 111.32;
      const dlng = (locs[i].lng - locs[i-1].lng) * 111.32 * Math.cos(locs[i].lat * Math.PI / 180);
      kmToday += Math.sqrt(dlat*dlat + dlng*dlng);
    }
    // Calculate earnings (salary_type can be JSON array)
    let earningsToday = 0;
    let st = courier.salary_type;
    let sv = courier.salary_value;
    if (typeof st === 'string' && st.startsWith('[')) try { st = JSON.parse(st); } catch(e) { st = [st]; }
    else if (typeof st === 'string') st = [st];
    if (typeof sv === 'string' && sv.startsWith('{')) try { sv = JSON.parse(sv); } catch(e) { sv = {}; }
    if (Array.isArray(st)) {
      if (st.includes('per_order')) earningsToday += (sv?.per_order || 0) * ordersCount;
      if (st.includes('salary')) earningsToday += (sv?.salary || 0) / 30;
      if (st.includes('per_km')) earningsToday += (sv?.per_km || 0) * kmToday;
    }
    // Online time today
    const logs = db.prepare("SELECT * FROM courier_activity_log WHERE staff_id = ? AND date = ? ORDER BY time ASC").all(req.params.id, today);
    let onlineMinutes = 0;
    let lastOnline = null;
    for (const log of logs) {
      if (log.status === 1) lastOnline = log.time;
      else if (log.status === 0 && lastOnline) {
        const [sh, sm] = lastOnline.split(':').map(Number);
        const [eh, em] = log.time.split(':').map(Number);
        onlineMinutes += (eh * 60 + em) - (sh * 60 + sm);
        lastOnline = null;
      }
    }
    if (lastOnline) {
      const now = new Date();
      const [sh, sm] = lastOnline.split(':').map(Number);
      onlineMinutes += (now.getHours() * 60 + now.getMinutes()) - (sh * 60 + sm);
    }
    res.json(toCamelCase({ ...courier, deliveredToday: ordersCount, kmToday: Math.round(kmToday * 100) / 100, earningsToday: Math.round(earningsToday), onlineMinutes }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/courier/online', (req, res) => {
  try {
    const { staff_id, is_online } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'ID сотрудника обязателен' });
    db.prepare('UPDATE staff SET is_online = ? WHERE id = ?').run(is_online ? 1 : 0, staff_id);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
    db.prepare('INSERT INTO courier_activity_log (staff_id, status, date, time) VALUES (?, ?, ?, ?)').run(staff_id, is_online ? 1 : 0, today, time);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/courier/location', async (req, res) => {
  try {
    const { staff_id, lat, lng } = req.body;
    if (!staff_id || lat === undefined || lng === undefined) return res.status(400).json({ error: 'ID, широта и долгота обязательны' });
    db.prepare('INSERT INTO courier_locations (staff_id, lat, lng) VALUES (?, ?, ?)').run(staff_id, lat, lng);
    db.prepare('UPDATE staff SET last_location = ? WHERE id = ?').run(`${lat},${lng}`, staff_id);
    broadcast(JSON.stringify({ type: 'courier:location', courier_id: staff_id, latitude: lat, longitude: lng }));
    // If courier is returning, recalculate ETA with Yandex Maps
    const returning = db.prepare("SELECT id, courier_name FROM orders WHERE courier_id = ? AND is_returning = 1 AND status = 'delivered' LIMIT 1").get(staff_id);
    if (returning) {
      const rc = getRestaurantCoords();
      if (rc) {
        const route = await calcRoute(lat, lng, rc.lat, rc.lng);
        const eta = new Date(Date.now() + route.durationMin * 60000).toISOString();
        db.prepare('UPDATE orders SET return_distance_km = ?, return_duration_min = ?, return_eta = ?, return_courier_lat = ?, return_courier_lng = ?, return_route_polyline = ? WHERE id = ?')
          .run(route.distanceKm, route.durationMin, eta, lat, lng, route.polyline, returning.id);
        broadcast(JSON.stringify({ type: 'courier:returning-update', orderId: returning.id, courierName: returning.courier_name || '', distanceKm: route.distanceKm, durationMin: route.durationMin, eta, courierLat: lat, courierLng: lng, polyline: route.polyline }));
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/courier-guest-chats', (req, res) => {
  try {
    const { order_id, status, courier_id, guest_phone, guest_id, search, tenant_id } = req.query;
    let sql = 'SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.tenant_id = current_tenant_id()';
    const conditions = [];
    const params = [];
    if (tenant_id) { conditions.push('cgc.tenant_id = ?'); params.push(tenant_id); }
    if (order_id) { conditions.push('cgc.order_id = ?'); params.push(order_id); }
    if (status && status !== 'all') { conditions.push('cgc.status = ?'); params.push(status); }
    if (courier_id && courier_id !== '0') { conditions.push('cgc.courier_id = ?'); params.push(courier_id); }
    if (guest_phone) { conditions.push('cgc.guest_phone = ?'); params.push(guest_phone); }
    if (guest_id && guest_id !== '0') { conditions.push('cgc.guest_id = ?'); params.push(guest_id); }
    if (search) { conditions.push('(cgc.last_message LIKE ? OR cgc.courier_name LIKE ? OR cgc.guest_name LIKE ? OR cgc.guest_phone LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q, q); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY cgc.updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(cgChatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/courier-guest-chats', (req, res) => {
  try {
    const { tenant_id, order_id, courier_id, courier_name, guest_id, guest_name, guest_phone } = req.body;
    const existing = db.prepare('SELECT * FROM courier_guest_chats WHERE order_id = ? AND status = ?').get(order_id, 'open');
    if (existing) return res.json(cgChatToCamel(existing));
    const info = db.prepare(
      `INSERT INTO courier_guest_chats (tenant_id, order_id, courier_id, courier_name, guest_id, guest_name, guest_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(tenant_id || 1, order_id || 0, courier_id || 0, courier_name || '', guest_id || 0, guest_name || '', guest_phone || '');
    const chat = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    const data = cgChatToCamel(chat);
    io.emit('cg-chat:new', data);
    broadcast(JSON.stringify({ type: 'cg-chat:new', data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/courier-guest-chats/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Chat not found' });
    res.json(cgChatToCamel(row));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/courier-guest-chats/:id/close', (req, res) => {
  try {
    db.prepare("UPDATE courier_guest_chats SET status = 'closed', closed_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?")
      .run(req.params.id);
    const chat = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = cgChatToCamel(chat);
    io.emit('cg-chat:closed', data);
    broadcast(JSON.stringify({ type: 'cg-chat:closed', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/courier-guest-chats/:id/important', (req, res) => {
  try {
    const { isImportant } = req.body;
    db.prepare('UPDATE courier_guest_chats SET is_important = ?, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(isImportant ? 1 : 0, req.params.id);
    const chat = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = cgChatToCamel(chat);
    io.emit('cg-chat:important', data);
    broadcast(JSON.stringify({ type: 'cg-chat:important', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/courier-guest-chats/:id/messages', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM courier_guest_messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
    const result = rows.map(cgChatToCamel);
    for (const r of result) {
      if (r.locationData) { try { r.locationData = JSON.parse(r.locationData); } catch {} }
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/courier-guest-chats/:id/messages', (req, res) => {
  try {
    const { sender_id, sender_type, sender_name, message, file_url, message_type, location_data } = req.body;
    const locData = location_data ? (typeof location_data === 'string' ? location_data : JSON.stringify(location_data)) : '';
    const msgType = message_type || 'text';
    const info = db.prepare(
      `INSERT INTO courier_guest_messages (chat_id, sender_id, sender_type, sender_name, message, file_url, message_type, location_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, sender_id || 0, sender_type || 'courier', sender_name || '', message || '', file_url || '', msgType, locData);
    const msg = db.prepare('SELECT * FROM courier_guest_messages WHERE id = ?').get(info.lastInsertRowid);
    const data = cgChatToCamel(msg);
    if (data.locationData) { try { data.locationData = JSON.parse(data.locationData); } catch {} }

    const displayMsg = msgType === 'location' ? '📍 Местоположение' : (msgType === 'photo' ? '📷 Фото' : (message || ''));
    db.prepare(`UPDATE courier_guest_chats SET last_message = ?, last_message_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?`)
      .run(displayMsg, req.params.id);

    io.emit('cg-chat:message', { chatId: parseInt(req.params.id), message: data });
    broadcast(JSON.stringify({ type: 'cg-chat:message', chatId: parseInt(req.params.id), message: data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/courier/templates', (req, res) => {
  try {
    const { user_id, tenant_id } = req.query;
    const systemTemplates = db.prepare('SELECT * FROM courier_chat_templates WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC').all(tenant_id || 1);
    const personalTemplates = user_id ? db.prepare('SELECT * FROM courier_personal_templates WHERE user_id = ? ORDER BY created_at DESC').all(user_id) : [];
    res.json({
      system: systemTemplates.map(t => ({ ...t, isActive: !!t.is_active, sortOrder: t.sort_order })),
      personal: personalTemplates,
    });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/courier/templates/personal', (req, res) => {
  try {
    const { user_id, text } = req.body;
    if (!user_id || !text) return res.status(400).json({ error: 'user_id and text required' });
    const info = db.prepare('INSERT INTO courier_personal_templates (user_id, text) VALUES (?, ?)').run(user_id, text);
    const tmpl = db.prepare('SELECT * FROM courier_personal_templates WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(tmpl);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/courier/templates/personal/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM courier_personal_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
};