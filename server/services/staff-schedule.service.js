const staffScheduleService = {
  getSchedules(db, tenantId = 1, weekStart = null) {
    let query = 'SELECT * FROM staff_schedules WHERE tenant_id = ?';
    const params = [tenantId];
    if (weekStart) { query += ' AND date >= ? AND date < date(?, ?)'; params.push(weekStart, weekStart, '+7 days'); }
    query += ' ORDER BY date, staff_id';
    return db.prepare(query).all(...params);
  },

  saveSchedule(db, { staffId, staffName, date, startTime, endTime }, tenantId = 1) {
    const existing = db.prepare('SELECT id FROM staff_schedules WHERE staff_id = ? AND date = ? AND tenant_id = ?').get(staffId, date, tenantId);
    if (existing) {
      db.prepare('UPDATE staff_schedules SET start_time = ?, end_time = ? WHERE id = ?').run(startTime, endTime, existing.id);
      return { id: existing.id, updated: true };
    }
    const r = db.prepare('INSERT INTO staff_schedules (tenant_id, staff_id, staff_name, date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)').run(tenantId, staffId, staffName, date, startTime, endTime);
    return { id: r.lastInsertRowid, created: true };
  },

  deleteSchedule(db, id, tenantId = 1) {
    db.prepare('DELETE FROM staff_schedules WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  },

  getStaffList(db, tenantId = 1) {
    return db.prepare('SELECT id, name, role FROM staff WHERE tenant_id = ? AND role IN (?) ORDER BY name').all(tenantId, ['waiter', 'chef', 'courier', 'manager']);
  },

  getWeekDays(weekStart) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  },

  getCurrentWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  },
};

module.exports = staffScheduleService;
