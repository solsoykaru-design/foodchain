function parseSalary(st) {
  let types = st;
  if (typeof types === 'string' && types.startsWith('[')) {
    try { types = JSON.parse(types); } catch { types = [types]; }
  } else if (typeof types === 'string') {
    types = [types];
  }
  if (!Array.isArray(types)) types = [];
  return types;
}

function parseSalaryValue(sv) {
  let value = sv;
  if (typeof value === 'string' && value.startsWith('{')) {
    try { value = JSON.parse(value); } catch { value = {}; }
  }
  if (typeof value !== 'object' || value === null) value = {};
  return value;
}

function getPeriodDates(from, to) {
  const today = new Date().toISOString().split('T')[0];
  const start = from || today;
  const end = to || today;
  return { start, end };
}

function getDeliveredOrders(db, tenantId, courierId, start, end) {
  return db.prepare(`
    SELECT * FROM orders
    WHERE courier_id = ? AND tenant_id = ? AND status = 'delivered'
      AND date(updated_at) >= date(?) AND date(updated_at) <= date(?)
    ORDER BY updated_at ASC
  `).all(courierId, tenantId, start, end);
}

function getKm(db, courierId, start, end) {
  const locs = db.prepare(`
    SELECT lat, lng FROM courier_locations
    WHERE staff_id = ? AND date(recorded_at) >= date(?) AND date(recorded_at) <= date(?)
    ORDER BY recorded_at ASC
  `).all(courierId, start, end);
  let km = 0;
  for (let i = 1; i < locs.length; i++) {
    const dlat = (locs[i].lat - locs[i - 1].lat) * 111.32;
    const dlng = (locs[i].lng - locs[i - 1].lng) * 111.32 * Math.cos(locs[i].lat * Math.PI / 180);
    km += Math.sqrt(dlat * dlat + dlng * dlng);
  }
  return Math.round(km * 100) / 100;
}

function getRating(db, tenantId, courierId, start, end) {
  const row = db.prepare(`
    SELECT COALESCE(AVG(r.rating), 0) as avg FROM reviews r
    JOIN orders o ON r.order_id = o.id
    WHERE o.courier_id = ? AND o.tenant_id = ? AND date(o.updated_at) >= date(?) AND date(o.updated_at) <= date(?)
  `).get(courierId, tenantId, start, end);
  return Math.round((row?.avg || 0) * 10) / 10;
}

function calcEarnings(orders, km, salaryType, salaryValue) {
  const types = parseSalary(salaryType);
  const sv = parseSalaryValue(salaryValue);
  let earnings = 0;
  if (types.includes('per_order')) earnings += (sv.per_order || 0) * orders.length;
  if (types.includes('per_km')) earnings += (sv.per_km || 0) * km;
  if (types.includes('salary') || types.includes('fixed')) {
    // Approximate days worked by distinct delivery dates
    const days = new Set(orders.map(o => o.updated_at?.slice(0, 10))).size;
    const daily = (sv.salary || sv.fixed || 0) / 30;
    earnings += daily * Math.max(days, 1);
  }
  return Math.round(earnings);
}

function avgDeliveryMinutes(orders) {
  let total = 0;
  let count = 0;
  for (const o of orders) {
    if (!o.created_at || !o.updated_at) continue;
    const diff = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000;
    if (diff > 0) { total += diff; count++; }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

function getCourierStats(db, tenantId, courierId, from, to) {
  const { start, end } = getPeriodDates(from, to);
  const courier = db.prepare('SELECT * FROM staff WHERE id = ? AND tenant_id = ? AND role = ?').get(courierId, tenantId, 'courier');
  if (!courier) return null;

  const orders = getDeliveredOrders(db, tenantId, courierId, start, end);
  const km = getKm(db, courierId, start, end);
  const rating = getRating(db, tenantId, courierId, start, end);
  const earnings = calcEarnings(orders, km, courier.salary_type, courier.salary_value);
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return {
    courierId,
    period: { start, end },
    deliveries: orders.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageOrder: orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
    earnings,
    km,
    rating,
    avgDeliveryMinutes: avgDeliveryMinutes(orders),
  };
}

function getLeaderboard(db, tenantId, from, to) {
  const { start, end } = getPeriodDates(from, to);
  const couriers = db.prepare('SELECT * FROM staff WHERE tenant_id = ? AND role = ?').all(tenantId, 'courier');
  const rows = couriers.map(c => {
    const orders = getDeliveredOrders(db, tenantId, c.id, start, end);
    const km = getKm(db, c.id, start, end);
    const rating = getRating(db, tenantId, c.id, start, end);
    const earnings = calcEarnings(orders, km, c.salary_type, c.salary_value);
    return {
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Курьер',
      deliveries: orders.length,
      earnings,
      km,
      rating,
    };
  });
  return rows.sort((a, b) => b.deliveries - a.deliveries);
}

module.exports = { getCourierStats, getLeaderboard };
