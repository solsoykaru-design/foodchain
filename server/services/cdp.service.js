const pos = require('./pos.service');

function getTenantId() {
  const store = pos.getStore?.();
  return store?.tenantId || 1;
}

function calculateRfm(db, tenantId) {
  const users = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND role = ?').all(tenantId, 'guest');
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO user_rfm (user_id, tenant_id, recency_days, frequency, monetary, r_score, f_score, m_score, segment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, tenant_id) DO UPDATE SET
      recency_days=excluded.recency_days,
      frequency=excluded.frequency,
      monetary=excluded.monetary,
      r_score=excluded.r_score,
      f_score=excluded.f_score,
      m_score=excluded.m_score,
      segment=excluded.segment,
      calculated_at=datetime('now')
  `);

  for (const u of users) {
    const orders = db.prepare(`
      SELECT total, created_at FROM orders
      WHERE user_id = ? AND status IN ('paid', 'closed', 'delivered')
      ORDER BY created_at DESC
    `).all(u.id);
    if (orders.length === 0) continue;

    const last = new Date(orders[0].created_at).getTime();
    const recencyDays = Math.max(0, Math.floor((now - last) / 86400000));
    const frequency = orders.length;
    const monetary = orders.reduce((s, o) => s + (o.total || 0), 0);

    const rScore = scoreRecency(recencyDays);
    const fScore = scoreFrequency(frequency);
    const mScore = scoreMonetary(monetary);
    const segment = classifySegment(rScore, fScore, mScore);

    stmt.run(u.id, tenantId, recencyDays, frequency, monetary, rScore, fScore, mScore, segment);
  }
  return { success: true, calculated: users.length };
}

function scoreRecency(days) {
  if (days <= 7) return 5;
  if (days <= 30) return 4;
  if (days <= 90) return 3;
  if (days <= 180) return 2;
  return 1;
}
function scoreFrequency(freq) {
  if (freq >= 20) return 5;
  if (freq >= 10) return 4;
  if (freq >= 5) return 3;
  if (freq >= 2) return 2;
  return 1;
}
function scoreMonetary(sum) {
  if (sum >= 50000) return 5;
  if (sum >= 20000) return 4;
  if (sum >= 10000) return 3;
  if (sum >= 3000) return 2;
  return 1;
}

function classifySegment(r, f, m) {
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  if (r >= 4 && f >= 3) return 'loyal';
  if (r >= 4 && f <= 2) return 'new';
  if (r >= 3 && f >= 3 && m >= 3) return 'potential';
  if (r <= 2 && f >= 4) return 'at_risk';
  if (r <= 2 && f <= 2 && m >= 3) return 'hibernating';
  return 'others';
}

function getSegments(db, tenantId) {
  const rows = db.prepare(`
    SELECT segment, COUNT(*) as count, AVG(monetary) as avg_monetary, AVG(recency_days) as avg_recency
    FROM user_rfm
    WHERE tenant_id = ?
    GROUP BY segment
  `).all(tenantId);
  return rows;
}

function getCdpProfile(db, tenantId, userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(userId, tenantId);
  if (!user) return null;
  const rfm = db.prepare('SELECT * FROM user_rfm WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId);
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId);
  const orderIds = orders.map(o => o.id);
  let items = [];
  if (orderIds.length) {
    const placeholders = orderIds.map(() => '?').join(',');
    items = db.prepare(`SELECT dish_id, name, COUNT(*) as cnt FROM order_items WHERE order_id IN (${placeholders}) GROUP BY dish_id ORDER BY cnt DESC LIMIT 10`).all(...orderIds);
  }
  const reviews = db.prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
  return {
    user: { ...user, bonusBalance: user.bonus_balance || 0, loyaltyLevel: user.loyalty_level || 'новичок' },
    rfm,
    orders: orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })),
    topDishes: items,
    reviews,
  };
}

module.exports = { calculateRfm, getSegments, getCdpProfile };
