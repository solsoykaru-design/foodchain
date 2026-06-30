const payrollService = require('./payroll.service');

function parseSalaryTypeValue(staff) {
  let st = staff.salary_type;
  let sv = staff.salary_value;
  try { st = JSON.parse(st); } catch (e) {}
  try { sv = JSON.parse(sv); } catch (e) {}
  if (!Array.isArray(st)) st = st ? [st] : [];
  if (typeof sv !== 'object' || sv === null) sv = {};
  return { types: st, values: sv };
}

function shiftDateTime(dateStr, timeStr) {
  const [h, m, s = 0] = timeStr.split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h, m, s || 0, 0);
  return d;
}

function shiftRange(shift) {
  let start = shiftDateTime(shift.date, shift.start_time);
  let end = shiftDateTime(shift.date, shift.end_time);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

function toSqlite(dt) {
  return dt.toISOString().replace('T', ' ').replace('Z', '');
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateShiftEarnings(db, tenantId, timesheetId) {
  const row = db.prepare(`
    SELECT t.*, s.first_name, s.last_name, s.role, s.salary_type, s.salary_value, s.hourly_rate
    FROM timesheet t
    JOIN staff s ON s.id = t.staff_id
    WHERE t.id = ? AND t.tenant_id = ?
  `).get(timesheetId, tenantId);
  if (!row) return null;

  const { types, values } = parseSalaryTypeValue(row);
  const { start, end } = shiftRange(row);
  const breakMinutes = Number(row.break_minutes || 0);
  const workMinutes = Math.max(0, (end - start) / 60000 - breakMinutes);
  const workHours = workMinutes / 60;

  const startStr = toSqlite(start);
  const endStr = toSqlite(end);

  const ordersCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM orders
    WHERE courier_id = ? AND status = 'delivered'
      AND datetime(updated_at) >= datetime(?) AND datetime(updated_at) <= datetime(?)
      AND tenant_id = ?
  `).get(row.staff_id, startStr, endStr, tenantId).cnt;

  const locs = db.prepare(`
    SELECT lat, lng FROM courier_locations
    WHERE staff_id = ? AND datetime(recorded_at) >= datetime(?) AND datetime(recorded_at) <= datetime(?)
    ORDER BY recorded_at ASC
  `).all(row.staff_id, startStr, endStr, tenantId);
  let km = 0;
  for (let i = 1; i < locs.length; i++) {
    km += haversineKm(locs[i - 1].lat, locs[i - 1].lng, locs[i].lat, locs[i].lng);
  }
  km = Math.round(km * 100) / 100;

  let perOrderAmount = 0;
  let perKmAmount = 0;
  let hourlyAmount = 0;

  if (types.includes('per_order')) {
    perOrderAmount = Math.round((values.per_order || 0) * ordersCount * 100) / 100;
  }
  if (types.includes('per_km')) {
    perKmAmount = Math.round((values.per_km || 0) * km * 100) / 100;
  }
  if (types.includes('hourly')) {
    const rate = Number(values.hourly || row.hourly_rate || 0);
    const br = payrollService.calculateShiftBreakdown(row.date, row.start_time, row.end_time);
    const regularPay = rate * br.regular;
    const nightPay = rate * br.night * (payrollService.getSettings(db, tenantId).night_rate_multiplier - 1);
    const holidayPay = rate * br.total * (payrollService.getSettings(db, tenantId).holiday_rate_multiplier - 1);
    hourlyAmount = Math.round((regularPay + nightPay + holidayPay) * 100) / 100;
  }

  const total = Math.round((perOrderAmount + perKmAmount + hourlyAmount) * 100) / 100;

  return {
    timesheet_id: row.id,
    staff_id: row.staff_id,
    staff_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    work_hours: Math.round(workHours * 100) / 100,
    orders_count: ordersCount,
    km,
    per_order_amount: perOrderAmount,
    per_km_amount: perKmAmount,
    hourly_amount: hourlyAmount,
    total_amount: total,
    details: { types, values, break_minutes: breakMinutes },
  };
}

function saveShiftPayroll(db, tenantId, calc) {
  const existing = db.prepare('SELECT id FROM courier_shift_payroll WHERE tenant_id = ? AND timesheet_id = ?').get(tenantId, calc.timesheet_id);
  const details = JSON.stringify(calc.details);
  if (existing) {
    db.prepare(`UPDATE courier_shift_payroll
      SET staff_id = ?, date = ?, orders_count = ?, km = ?, per_order_amount = ?, per_km_amount = ?, hourly_amount = ?, total_amount = ?, details = ?, calculated_at = datetime('now')
      WHERE id = ?`)
      .run(calc.staff_id, calc.date, calc.orders_count, calc.km, calc.per_order_amount, calc.per_km_amount, calc.hourly_amount, calc.total_amount, details, existing.id);
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO courier_shift_payroll
    (tenant_id, timesheet_id, staff_id, date, orders_count, km, per_order_amount, per_km_amount, hourly_amount, total_amount, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(tenantId, calc.timesheet_id, calc.staff_id, calc.date, calc.orders_count, calc.km, calc.per_order_amount, calc.per_km_amount, calc.hourly_amount, calc.total_amount, details);
  return info.lastInsertRowid;
}

function calculateMonthForRole(db, tenantId, month, year, role = 'courier') {
  const { start, end } = payrollService.calcMonthDates(month, year);
  const rows = db.prepare(`
    SELECT t.id FROM timesheet t
    JOIN staff s ON s.id = t.staff_id
    WHERE t.tenant_id = ? AND t.date BETWEEN ? AND ? AND s.role = ?
  `).all(tenantId, start, end, role);
  const result = [];
  for (const { id } of rows) {
    const calc = calculateShiftEarnings(db, tenantId, id);
    if (calc) {
      saveShiftPayroll(db, tenantId, calc);
      result.push(calc);
    }
  }
  return result;
}

function getStoredPayroll(db, tenantId, month, year, staffId = null) {
  const { start, end } = payrollService.calcMonthDates(month, year);
  let sql = `SELECT csp.*, s.first_name, s.last_name FROM courier_shift_payroll csp
    JOIN staff s ON s.id = csp.staff_id
    WHERE csp.tenant_id = ? AND csp.date BETWEEN ? AND ?`;
  const params = [tenantId, start, end];
  if (staffId) { sql += ' AND csp.staff_id = ?'; params.push(Number(staffId)); }
  sql += ' ORDER BY csp.date DESC, s.first_name ASC';
  return db.prepare(sql).all(...params);
}

function calculateShiftKpi(db, tenantId, timesheetId) {
  const shift = db.prepare(`
    SELECT t.*, s.first_name, s.last_name, s.role
    FROM timesheet t
    JOIN staff s ON s.id = t.staff_id
    WHERE t.id = ? AND t.tenant_id = ?
  `).get(timesheetId, tenantId);
  if (!shift) return [];

  const { start, end } = shiftRange(shift);
  const startStr = toSqlite(start);
  const endStr = toSqlite(end);

  const kpis = db.prepare('SELECT * FROM kpi_bonuses WHERE (role = ? OR role = "all") AND tenant_id = ? AND is_active = 1').all(shift.role || '', tenantId);
  const achievements = [];

  for (const kpi of kpis) {
    let value = 0;
    if (kpi.metric === 'orders_delivered') {
      value = db.prepare(`
        SELECT COUNT(*) as cnt FROM orders
        WHERE courier_id = ? AND status = 'delivered'
          AND datetime(updated_at) >= datetime(?) AND datetime(updated_at) <= datetime(?)
          AND tenant_id = ?
      `).get(shift.staff_id, startStr, endStr, tenantId).cnt;
    } else if (kpi.metric === 'sales_amount') {
      value = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as sum FROM orders
        WHERE (waiter_id = ? OR courier_id = ?) AND status != 'cancelled'
          AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)
          AND tenant_id = ?
      `).get(shift.staff_id, shift.staff_id, startStr, endStr, tenantId).sum;
    } else if (kpi.metric === 'shifts_count') {
      value = 1;
    }
    const achieved = value >= (kpi.threshold || 0) ? 1 : 0;
    achievements.push({
      timesheet_id: shift.id,
      staff_id: shift.staff_id,
      date: shift.date,
      kpi_name: kpi.name,
      metric: kpi.metric,
      threshold: kpi.threshold || 0,
      value,
      bonus_amount: achieved ? Number(kpi.bonus_amount || 0) : 0,
      achieved,
    });
  }

  // Upsert
  for (const a of achievements) {
    const existing = db.prepare('SELECT id FROM shift_kpi_achievements WHERE tenant_id = ? AND timesheet_id = ? AND kpi_name = ?').get(tenantId, a.timesheet_id, a.kpi_name);
    if (existing) {
      db.prepare(`UPDATE shift_kpi_achievements SET staff_id = ?, date = ?, metric = ?, threshold = ?, value = ?, bonus_amount = ?, achieved = ?, calculated_at = datetime('now') WHERE id = ?`)
        .run(a.staff_id, a.date, a.metric, a.threshold, a.value, a.bonus_amount, a.achieved, existing.id);
    } else {
      db.prepare(`INSERT INTO shift_kpi_achievements (tenant_id, timesheet_id, staff_id, date, kpi_name, metric, threshold, value, bonus_amount, achieved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(tenantId, a.timesheet_id, a.staff_id, a.date, a.kpi_name, a.metric, a.threshold, a.value, a.bonus_amount, a.achieved);
    }
  }

  return achievements;
}

function calculateMonthKpi(db, tenantId, month, year) {
  const { start, end } = payrollService.calcMonthDates(month, year);
  const rows = db.prepare('SELECT id FROM timesheet WHERE tenant_id = ? AND date BETWEEN ? AND ?').all(tenantId, start, end);
  const result = [];
  for (const { id } of rows) {
    result.push(...calculateShiftKpi(db, tenantId, id));
  }
  return result;
}

function getStoredShiftKpi(db, tenantId, month, year, staffId = null) {
  const { start, end } = payrollService.calcMonthDates(month, year);
  let sql = `SELECT ska.*, s.first_name, s.last_name FROM shift_kpi_achievements ska
    JOIN staff s ON s.id = ska.staff_id
    WHERE ska.tenant_id = ? AND ska.date BETWEEN ? AND ?`;
  const params = [tenantId, start, end];
  if (staffId) { sql += ' AND ska.staff_id = ?'; params.push(Number(staffId)); }
  sql += ' ORDER BY ska.date DESC, s.first_name ASC';
  return db.prepare(sql).all(...params);
}

module.exports = {
  calculateShiftEarnings,
  saveShiftPayroll,
  calculateMonthForRole,
  getStoredPayroll,
  calculateShiftKpi,
  calculateMonthKpi,
  getStoredShiftKpi,
};
