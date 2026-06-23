const crypto = require('crypto');
const bcrypt = require('bcrypt');

module.exports = function(app, db, config) {
  const { io, broadcast, safeError, toCamelCase, toCamelCaseArray, checkRoleLimit, uploadStaffChat } = config;

app.get('/api/staff/schedules', (req, res) => {
  try {
    const weekStart = req.query.week_start || staffScheduleService.getCurrentWeekStart();
    res.json(toCamelCaseArray(staffScheduleService.getSchedules(db, req.query.tenant_id || 1, weekStart)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff/schedules', (req, res) => {
  try {
    const { staffId, staffName, date, startTime, endTime } = req.body;
    if (!staffId || !date) return res.status(400).json({ error: 'Missing required fields' });
    const result = staffScheduleService.saveSchedule(db, { staffId, staffName, date, startTime: startTime || '09:00', endTime: endTime || '18:00' }, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/staff/schedules/:id', (req, res) => {
  try {
    staffScheduleService.deleteSchedule(db, req.params.id, req.query.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/staff/schedule-staff', (req, res) => {
  try {
    res.json(toCamelCaseArray(staffScheduleService.getStaffList(db, req.query.tenant_id || 1)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/staff', (req, res) => {
  try {
    const staff = db.prepare('SELECT * FROM staff WHERE is_active = 1 ORDER BY role ASC, first_name ASC').all();
    const result = staff.map(s => {
      let isAvailable = null;
      let ordersHandled = 0;
      if (s.role === 'courier') {
        const courier = db.prepare('SELECT is_available, total_deliveries FROM couriers WHERE phone = ?').get(s.phone);
        if (courier) {
          isAvailable = !!courier.is_available;
          ordersHandled = courier.total_deliveries || 0;
        }
      }
      // Calculate today's online time for couriers
      let onlineToday = 0;
      if (s.role === 'courier') {
        const today = new Date().toISOString().split('T')[0];
        const logs = db.prepare("SELECT * FROM courier_activity_log WHERE staff_id = ? AND date = ? ORDER BY time ASC").all(s.id, today);
        let lastOnline = null;
        for (const log of logs) {
          if (log.status === 1) lastOnline = log.time;
          else if (log.status === 0 && lastOnline) {
            const [sh, sm] = lastOnline.split(':').map(Number);
            const [eh, em] = log.time.split(':').map(Number);
            onlineToday += (eh * 60 + em) - (sh * 60 + sm);
            lastOnline = null;
          }
        }
        if (lastOnline) {
          const now = new Date();
          const [sh, sm] = lastOnline.split(':').map(Number);
          onlineToday += (now.getHours() * 60 + now.getMinutes()) - (sh * 60 + sm);
        }
      }
      return toCamelCase({ ...s, isAvailable, ordersHandled, onlineToday });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/staff', (req, res) => {
  try {
    const { first_name, last_name, role, phone, email, password, photo_url, is_active, hourly_rate,
      username, salary_type, salary_value, position, tenant_id } = req.body;
    if (!first_name || !role) return res.status(400).json({ error: 'Имя и роль обязательны' });

    // Enforce role limits if tenant_id is provided
    if (tenant_id) {
      const limitCheck = checkRoleLimit(db, tenant_id, role, true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (phone) {
      const existing = db.prepare('SELECT id, first_name FROM staff WHERE phone = ? AND is_active = 1').get(phone);
      if (existing) return res.status(400).json({ error: `Телефон ${phone} уже используется (${existing.first_name})` });
    }
    const pwd = password ? bcrypt.hashSync(password, 10) : crypto.randomBytes(4).toString('hex');
    const st = salary_type ? (Array.isArray(salary_type) ? JSON.stringify(salary_type) : salary_type) : (role === 'courier' ? JSON.stringify(['per_order']) : null);
    const sv = salary_value ? (typeof salary_value === 'object' ? JSON.stringify(salary_value) : salary_value) : 0;
    const info = db.prepare('INSERT INTO staff (first_name, last_name, role, phone, email, password, photo_url, is_active, hourly_rate, username, salary_type, salary_value, position, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      first_name, last_name || '', role, phone || null, email || null, pwd, photo_url || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1, hourly_rate || 0,
      username || null, st, sv, position || role, tenant_id || null
    );
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(member));
  } catch (e) {
    console.error('STAFF_CREATE_ERROR:', e.message);
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/staff/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    const { first_name, last_name, role, phone, email, password, photo_url, is_active, hourly_rate,
      username, salary_type, salary_value, position } = req.body;
    const sets = []; const params = [];

    // Check limit if role is changing and tenant_id is available
    if (role !== undefined && role !== existing.role && existing.tenant_id) {
      const limitCheck = checkRoleLimit(db, existing.tenant_id, role, true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (first_name !== undefined) { sets.push('first_name = ?'); params.push(first_name); }
    if (last_name !== undefined) { sets.push('last_name = ?'); params.push(last_name); }
    if (role !== undefined) { sets.push('role = ?'); params.push(role); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone || null); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email || null); }
    if (password !== undefined) { sets.push('password = ?'); params.push(password ? bcrypt.hashSync(password, 10) : null); }
    if (photo_url !== undefined) { sets.push('photo_url = ?'); params.push(photo_url); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (hourly_rate !== undefined) { sets.push('hourly_rate = ?'); params.push(hourly_rate); }
    if (username !== undefined) { sets.push('username = ?'); params.push(username || null); }
    if (salary_type !== undefined) { sets.push('salary_type = ?'); params.push(salary_type != null && Array.isArray(salary_type) ? JSON.stringify(salary_type) : salary_type); }
    if (salary_value !== undefined) { sets.push('salary_value = ?'); params.push(salary_value != null && typeof salary_value === 'object' ? JSON.stringify(salary_value) : salary_value); }
    if (position !== undefined) { sets.push('position = ?'); params.push(position); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(member));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/staff/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    db.prepare('UPDATE staff SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.patch('/api/staff/:id/block', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    const newActive = existing.is_active ? 0 : 1;
    db.prepare('UPDATE staff SET is_active = ? WHERE id = ?').run(newActive, req.params.id);
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(member));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/staff/shifts', (req, res) => {
  try {
    const { staff_id, date } = req.query;
    let sql = 'SELECT * FROM staff_shifts WHERE 1=1';
    const params = [];
    if (staff_id) { sql += ' AND staff_id = ?'; params.push(Number(staff_id)); }
    if (date) { sql += ' AND date = ?'; params.push(date); }
    sql += ' ORDER BY date DESC, start_time ASC';
    const shifts = db.prepare(sql).all(...params);
    const result = shifts.map(sh => {
      const member = db.prepare('SELECT first_name, last_name FROM staff WHERE id = ?').get(sh.staff_id);
      const staffName = member ? `${member.first_name} ${member.last_name || ''}`.trim() : null;
      return toCamelCase({ ...sh, staffName });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/staff/shifts', (req, res) => {
  try {
    const { staff_id, date, start_time, end_time, branch_id, is_confirmed } = req.body;
    if (!staff_id || !date || !start_time || !end_time) return res.status(400).json({ error: 'ID сотрудника, дата, начало и конец обязательны' });
    const info = db.prepare('INSERT INTO staff_shifts (staff_id, date, start_time, end_time, branch_id, is_confirmed) VALUES (?, ?, ?, ?, ?, ?)').run(
      staff_id, date, start_time, end_time, branch_id || null, is_confirmed ? 1 : 0
    );
    const shift = db.prepare('SELECT * FROM staff_shifts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(shift));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/staff/shifts/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff_shifts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Смена не найдена' });
    db.prepare('DELETE FROM staff_shifts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/staff/:staff_id/permissions', (req, res) => {
  try {
    const perms = db.prepare('SELECT * FROM staff_permissions WHERE staff_id = ?').all(req.params.staff_id);
    res.json(toCamelCaseArray(perms));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/staff/:staff_id/permissions', (req, res) => {
  try {
    const { staff_id } = req.params;
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'Ожидается массив разрешений' });
    const existing = db.prepare('SELECT id FROM staff WHERE id = ?').get(staff_id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    db.prepare('DELETE FROM staff_permissions WHERE staff_id = ?').run(staff_id);
    const insert = db.prepare('INSERT INTO staff_permissions (staff_id, section, can_view, can_edit) VALUES (?, ?, ?, ?)');
    for (const p of permissions) {
      insert.run(staff_id, p.section, p.can_view !== false ? 1 : 0, p.can_edit ? 1 : 0);
    }
    const perms = db.prepare('SELECT * FROM staff_permissions WHERE staff_id = ?').all(staff_id);
    res.json(toCamelCaseArray(perms));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/themes', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM themes WHERE is_active = 1';
    const params = [];
    if (tenant_id) { sql += ' AND (tenant_id IS NULL OR tenant_id = ?)'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY is_preset DESC, name ASC';
    const themes = db.prepare(sql).all(...params);
    res.json(themes.map(t => ({ ...t, colors: JSON.parse(t.colors) })));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/themes/:id', (req, res) => {
  try {
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
    res.json({ ...theme, colors: JSON.parse(theme.colors) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/staff-roles', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM staff_roles ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff-roles', (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO staff_roles (name, permissions) VALUES (?, ?)').run(name, permissions || '{}');
    res.status(201).json({ id: info.lastInsertRowid, name, permissions: permissions || '{}' });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/staff-roles/:id', (req, res) => {
  try {
    const { name, permissions } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (permissions !== undefined) { sets.push('permissions = ?'); params.push(permissions); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE staff_roles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM staff_roles WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/staff-roles/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM staff_roles WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/staff-schedule', (req, res) => {
  try {
    const { staff_id } = req.query;
    let sql = 'SELECT ss.*, s.first_name || \' \' || COALESCE(s.last_name, \'\') as staff_name FROM staff_schedule ss LEFT JOIN staff s ON ss.staff_id = s.id WHERE ss.tenant_id = current_tenant_id()';
    const params = [];
    if (staff_id) { sql += ' AND ss.staff_id = ?'; params.push(staff_id); }
    sql += ' ORDER BY ss.day, ss.shift_start';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff-schedule', (req, res) => {
  try {
    const { staff_id, day, shift_start, shift_end } = req.body;
    if (!staff_id || !day) return res.status(400).json({ error: 'staff_id and day required' });
    const info = db.prepare('INSERT INTO staff_schedule (staff_id, day, shift_start, shift_end) VALUES (?, ?, ?, ?)').run(staff_id, day, shift_start || null, shift_end || null);
    res.status(201).json({ id: info.lastInsertRowid, staff_id, day, shift_start: shift_start || null, shift_end: shift_end || null });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/staff-schedule/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM staff_schedule WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/staff-chats', (req, res) => {
  try {
    const { order_id, status, courier_id, waiter_id, search, tenant_id } = req.query;
    let sql = 'SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.tenant_id = current_tenant_id()';
    const conditions = [];
    const params = [];
    if (tenant_id) { conditions.push('sc.tenant_id = ?'); params.push(tenant_id); }
    if (order_id) { conditions.push('sc.order_id = ?'); params.push(order_id); }
    if (status && status !== 'all') { conditions.push('sc.status = ?'); params.push(status); }
    if (courier_id && courier_id !== '0') { conditions.push('sc.courier_id = ?'); params.push(courier_id); }
    if (waiter_id && waiter_id !== '0') { conditions.push('sc.waiter_id = ?'); params.push(waiter_id); }
    if (search) { conditions.push('(sc.last_message LIKE ? OR sc.courier_name LIKE ? OR sc.waiter_name LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q); }
    if (conditions.length) sql += ' AND ' + conditions.join(' AND ');
    sql += ' ORDER BY sc.updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(chatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/staff-chats/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Staff chat not found' });
    res.json(chatToCamel(row));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff-chats', (req, res) => {
  try {
    const { tenant_id, order_id, courier_id, courier_name, waiter_id, waiter_name } = req.body;
    const existing = db.prepare('SELECT * FROM staff_chats WHERE order_id = ? AND status = ?').get(order_id, 'open');
    if (existing) return res.json(chatToCamel(existing));
    const info = db.prepare(
      `INSERT INTO staff_chats (tenant_id, order_id, courier_id, courier_name, waiter_id, waiter_name)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tenant_id || 1, order_id || 0, courier_id || 0, courier_name || '', waiter_id || 0, waiter_name || '');
    const chat = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    const data = chatToCamel(chat);
    io.emit('staff-chat:new', data);
    broadcast(JSON.stringify({ type: 'staff-chat:new', data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/staff-chats/:id/messages', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM staff_chat_messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
    const result = rows.map(chatToCamel);
    for (const r of result) {
      if (r.locationData) { try { r.locationData = JSON.parse(r.locationData); } catch {} }
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff-chats/:id/messages', (req, res) => {
  try {
    const { sender_id, sender_type, sender_name, message, file_url, message_type, location_data } = req.body;
    const locData = location_data ? (typeof location_data === 'string' ? location_data : JSON.stringify(location_data)) : '';
    const msgType = message_type || 'text';
    const info = db.prepare(
      `INSERT INTO staff_chat_messages (chat_id, sender_id, sender_type, sender_name, message, file_url, message_type, location_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, sender_id || 0, sender_type || 'courier', sender_name || '', message || '', file_url || '', msgType, locData);
    const msg = db.prepare('SELECT * FROM staff_chat_messages WHERE id = ?').get(info.lastInsertRowid);
    const data = chatToCamel(msg);
    if (data.locationData) { try { data.locationData = JSON.parse(data.locationData); } catch {} }

    const displayMsg = msgType === 'location' ? '📍 Местоположение' : (message || '');
    db.prepare(`UPDATE staff_chats SET last_message = ?, last_message_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?`)
      .run(displayMsg, req.params.id);

    io.emit('staff-chat:message', { chatId: parseInt(req.params.id), message: data });
    broadcast(JSON.stringify({ type: 'staff-chat:message', chatId: parseInt(req.params.id), message: data }));

    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/staff-chats/:id/close', (req, res) => {
  try {
    db.prepare("UPDATE staff_chats SET status = 'closed', closed_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?")
      .run(req.params.id);
    const chat = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('staff-chat:closed', data);
    broadcast(JSON.stringify({ type: 'staff-chat:closed', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/staff-chats/:id/important', (req, res) => {
  try {
    const { isImportant } = req.body;
    db.prepare('UPDATE staff_chats SET is_important = ?, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(isImportant ? 1 : 0, req.params.id);
    const chat = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('staff-chat:important', data);
    broadcast(JSON.stringify({ type: 'staff-chat:important', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff-chats/upload', uploadStaffChat.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/staff-chat/${req.file.filename}`, filename: req.file.filename });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
};