function calcMonthDates(month, year) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
}

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isNightMinute(minuteOfDay) {
  const h = Math.floor(minuteOfDay / 60);
  return h >= 22 || h < 6;
}

function isHoliday(dateStr, holidays) {
  return holidays.includes(dateStr);
}

function getRussianHolidays(year) {
  // Fixed Russian holidays
  return [
    `${year}-01-01`, `${year}-01-02`, `${year}-01-03`, `${year}-01-04`, `${year}-01-05`, `${year}-01-06`, `${year}-01-07`, `${year}-01-08`,
    `${year}-02-23`, `${year}-03-08`, `${year}-05-01`, `${year}-05-09`, `${year}-06-12`, `${year}-11-04`, `${year}-12-31`
  ];
}

function getSettings(db, tenantId) {
  let s = db.prepare('SELECT * FROM payroll_settings WHERE tenant_id = ?').get(tenantId);
  if (!s) {
    db.prepare('INSERT INTO payroll_settings (tenant_id) VALUES (?)').run(tenantId);
    s = db.prepare('SELECT * FROM payroll_settings WHERE tenant_id = ?').get(tenantId);
  }
  return {
    ndfl_rate: s?.ndfl_rate ?? 0.13,
    night_rate_multiplier: s?.night_rate_multiplier ?? 1.5,
    holiday_rate_multiplier: s?.holiday_rate_multiplier ?? 2.0,
    overtime_rate_multiplier: s?.overtime_rate_multiplier ?? 1.5,
    weekly_hours_norm: s?.weekly_hours_norm ?? 40,
    daily_hours_norm: s?.daily_hours_norm ?? 8,
    kpi_enabled: s?.kpi_enabled ?? 1,
  };
}

function calculateShiftBreakdown(shiftDate, startTime, endTime) {
  const startMin = parseTime(startTime);
  const endMin = parseTime(endTime);
  if (startMin === null || endMin === null) return { regular: 0, night: 0, holiday: 0, overtime: 0, total: 0 };
  let totalMinutes = endMin - startMin;
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  let nightMinutes = 0;
  let current = startMin;
  for (let i = 0; i < totalMinutes; i++) {
    const mod = (current + i) % (24 * 60);
    if (isNightMinute(mod)) nightMinutes++;
  }

  const totalHours = totalMinutes / 60;
  const nightHours = nightMinutes / 60;
  const regularHours = totalHours - nightHours;
  return { regular: regularHours, night: nightHours, total: totalHours };
}

function calculateStaffSalary(db, tenantId, staffId, month, year) {
  const staff = db.prepare('SELECT * FROM staff WHERE id = ? AND tenant_id = ?').get(staffId, tenantId);
  if (!staff) return null;
  const { start, end } = calcMonthDates(month, year);
  const settings = getSettings(db, tenantId);
  const holidays = getRussianHolidays(year);

  let st = staff.salary_type;
  let sv = staff.salary_value;
  try { st = JSON.parse(st); } catch(e) {}
  try { sv = JSON.parse(sv); } catch(e) {}
  if (!Array.isArray(st)) st = [st];
  if (typeof sv !== 'object' || sv === null) sv = {};

  const details = {
    fixed: 0,
    per_order: { rate: 0, count: 0, amount: 0 },
    per_km: { rate: 0, km: 0, amount: 0 },
    hourly: { rate: 0, regular_hours: 0, night_hours: 0, holiday_hours: 0, overtime_hours: 0, amount: 0 },
    kpi: { amount: 0, metrics: {} },
    night_bonus: 0,
    holiday_bonus: 0,
    overtime_bonus: 0,
    ndfl: 0,
    gross: 0,
    net: 0,
  };

  let total = 0;

  if (st.includes('salary') || st.includes('fixed')) {
    const amt = Number(sv.salary || sv.fixed || 0);
    details.fixed = amt;
    total += amt;
  }

  if (st.includes('per_order')) {
    const rate = Number(sv.per_order || 0);
    const orderColumn = staff.role === 'waiter' ? 'waiter_id' : 'courier_id';
    const ordersCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM orders WHERE ${orderColumn} = ? AND status = 'delivered' AND date(updated_at) BETWEEN ? AND ? AND tenant_id = ?`
    ).get(staffId, start, end, tenantId).cnt;
    const amt = rate * ordersCount;
    details.per_order = { rate, count: ordersCount, amount: amt };
    total += amt;
  }

  if (st.includes('per_km')) {
    const rate = Number(sv.per_km || 0);
    const locs = db.prepare(
      "SELECT lat, lng FROM courier_locations WHERE courier_id = ? AND date(recorded_at) BETWEEN ? AND ? ORDER BY recorded_at ASC"
    ).all(staffId, start, end);
    let km = 0;
    for (let i = 1; i < locs.length; i++) {
      const dlat = (locs[i].lat - locs[i - 1].lat) * 111.32;
      const dlng = (locs[i].lng - locs[i - 1].lng) * 111.32 * Math.cos(locs[i].lat * Math.PI / 180);
      km += Math.sqrt(dlat * dlat + dlng * dlng);
    }
    const amt = rate * km;
    details.per_km = { rate, km: Math.round(km * 100) / 100, amount: Math.round(amt * 100) / 100 };
    total += amt;
  }

  if (st.includes('hourly')) {
    const rate = Number(sv.hourly || staff.hourly_rate || 0);
    const shifts = db.prepare(
      "SELECT date, start_time, end_time FROM staff_shifts WHERE staff_id = ? AND date BETWEEN ? AND ? AND tenant_id = ?"
    ).all(staffId, start, end, tenantId);
    let regularHours = 0, nightHours = 0, holidayHours = 0, totalHours = 0;
    for (const shift of shifts) {
      const br = calculateShiftBreakdown(shift.date, shift.start_time, shift.end_time);
      const isHol = isHoliday(shift.date, holidays);
      if (isHol) {
        holidayHours += br.total;
      } else {
        regularHours += br.regular;
        nightHours += br.night;
      }
      totalHours += br.total;
    }

    // Overtime: daily > norm
    let overtimeHours = 0;
    const shiftsByDate = {};
    for (const shift of shifts) {
      if (!shiftsByDate[shift.date]) shiftsByDate[shift.date] = 0;
      const br = calculateShiftBreakdown(shift.date, shift.start_time, shift.end_time);
      shiftsByDate[shift.date] += br.total;
    }
    for (const date of Object.keys(shiftsByDate)) {
      if (shiftsByDate[date] > settings.daily_hours_norm) {
        overtimeHours += shiftsByDate[date] - settings.daily_hours_norm;
      }
    }

    const baseAmount = rate * regularHours;
    const nightBonus = rate * nightHours * (settings.night_rate_multiplier - 1);
    const holidayBonus = rate * holidayHours * (settings.holiday_rate_multiplier - 1);
    const overtimeBonus = rate * overtimeHours * (settings.overtime_rate_multiplier - 1);
    const amt = baseAmount + nightBonus + holidayBonus + overtimeBonus;

    details.hourly = {
      rate,
      regular_hours: Math.round(regularHours * 100) / 100,
      night_hours: Math.round(nightHours * 100) / 100,
      holiday_hours: Math.round(holidayHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      amount: Math.round(amt * 100) / 100,
    };
    details.night_bonus = Math.round(nightBonus * 100) / 100;
    details.holiday_bonus = Math.round(holidayBonus * 100) / 100;
    details.overtime_bonus = Math.round(overtimeBonus * 100) / 100;
    total += amt;
  }

  // KPI bonuses
  if (settings.kpi_enabled) {
    const kpis = db.prepare('SELECT * FROM kpi_bonuses WHERE (role = ? OR role = "all") AND tenant_id = ? AND is_active = 1').all(staff.role || '', tenantId);
    for (const kpi of kpis) {
      let value = 0;
      if (kpi.metric === 'orders_delivered') {
        value = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE courier_id = ? AND status = 'delivered' AND date(updated_at) BETWEEN ? AND ? AND tenant_id = ?").get(staffId, start, end, tenantId).cnt;
      } else if (kpi.metric === 'sales_amount') {
        value = db.prepare("SELECT COALESCE(SUM(total),0) as sum FROM orders WHERE waiter_id = ? AND status != 'cancelled' AND date(created_at) BETWEEN ? AND ? AND tenant_id = ?").get(staffId, start, end, tenantId).sum;
      } else if (kpi.metric === 'shifts_count') {
        value = db.prepare("SELECT COUNT(*) as cnt FROM staff_shifts WHERE staff_id = ? AND date BETWEEN ? AND ? AND tenant_id = ?").get(staffId, start, end, tenantId).cnt;
      }
      if (value >= (kpi.threshold || 0)) {
        const bonus = Number(kpi.bonus_amount || 0);
        details.kpi.amount += bonus;
        details.kpi.metrics[kpi.name] = { value, threshold: kpi.threshold, bonus };
        total += bonus;
      }
    }
  }

  total = Math.round(total * 100) / 100;
  details.gross = total;
  details.ndfl = Math.round(total * settings.ndfl_rate * 100) / 100;
  details.net = Math.round((total - details.ndfl) * 100) / 100;

  return {
    staff_id: staffId,
    month,
    year,
    accrued_amount: total,
    ndfl_amount: details.ndfl,
    net_amount: details.net,
    details: JSON.stringify(details),
  };
}

function saveOrUpdateSalary(db, tenantId, calc) {
  const existing = db.prepare('SELECT id FROM salary WHERE staff_id = ? AND month = ? AND year = ? AND tenant_id = ?').get(calc.staff_id, calc.month, calc.year, tenantId);
  if (existing) {
    db.prepare('UPDATE salary SET accrued_amount = ?, ndfl_amount = ?, net_amount = ?, details = ?, status = ?, calculated_at = datetime(\'now\') WHERE id = ?')
      .run(calc.accrued_amount, calc.ndfl_amount, calc.net_amount, calc.details, 'calculated', existing.id);
    return existing.id;
  }
  const info = db.prepare('INSERT INTO salary (staff_id, month, year, accrued_amount, ndfl_amount, net_amount, details, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(calc.staff_id, calc.month, calc.year, calc.accrued_amount, calc.ndfl_amount, calc.net_amount, calc.details, 'calculated', tenantId);
  return info.lastInsertRowid;
}

function buildTimesheet(db, tenantId, staffId, month, year) {
  const { start, end } = calcMonthDates(month, year);
  const shifts = db.prepare('SELECT * FROM staff_shifts WHERE staff_id = ? AND date BETWEEN ? AND ? AND tenant_id = ? ORDER BY date').all(staffId, start, end, tenantId);
  const staff = db.prepare('SELECT * FROM staff WHERE id = ? AND tenant_id = ?').get(staffId, tenantId);
  return {
    staff_id: staffId,
    staff_name: staff ? `${staff.first_name} ${staff.last_name}` : '',
    month,
    year,
    days: shifts.map(s => {
      const br = calculateShiftBreakdown(s.date, s.start_time, s.end_time);
      return {
        date: s.date,
        start: s.start_time,
        end: s.end_time,
        regular_hours: br.regular,
        night_hours: br.night,
        total_hours: br.total,
      };
    }),
  };
}

function exportTimesheetForAuthorities(db, tenantId, month, year) {
  const { start, end } = calcMonthDates(month, year);
  const staffList = db.prepare('SELECT * FROM staff WHERE is_active = 1 AND tenant_id = ?').all(tenantId);
  const rows = [];
  for (const staff of staffList) {
    const shifts = db.prepare('SELECT * FROM staff_shifts WHERE staff_id = ? AND date BETWEEN ? AND ? AND tenant_id = ? ORDER BY date').all(staff.id, start, end, tenantId);
    for (const s of shifts) {
      const br = calculateShiftBreakdown(s.date, s.start_time, s.end_time);
      rows.push({
        inn: '',
        snils: '',
        employee_name: `${staff.last_name} ${staff.first_name}`,
        position: staff.position || '',
        date: s.date,
        hours: br.total.toFixed(2),
        night_hours: br.night.toFixed(2),
      });
    }
  }
  return rows;
}

module.exports = {
  calculateStaffSalary,
  saveOrUpdateSalary,
  buildTimesheet,
  exportTimesheetForAuthorities,
  getSettings,
  calcMonthDates,
};
