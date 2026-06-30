function isTimeInRange(timeStr, startStr, endStr) {
  if (!timeStr || !startStr || !endStr) return false;
  const now = new Date();
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const [th, tm] = timeStr.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const currentMin = th * 60 + tm;
  if (endMin < startMin) {
    return currentMin >= startMin || currentMin <= endMin;
  }
  return currentMin >= startMin && currentMin <= endMin;
}

function isDayMatch(dayOfWeek, days) {
  if (!days || days.length === 0) return true;
  return days.includes(dayOfWeek);
}

function getActiveRules(db, tenantId, context = {}) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dayOfWeek = now.getDay();
  const allRules = db.prepare('SELECT * FROM dynamic_pricing_rules WHERE tenant_id = ? AND is_active = 1 ORDER BY priority DESC').all(tenantId);
  return allRules.filter(rule => {
    try {
      const cfg = JSON.parse(rule.config || '{}');
      if (rule.type === 'happy_hour') {
        return isTimeInRange(timeStr, cfg.start_time, cfg.end_time) && isDayMatch(dayOfWeek, cfg.days);
      }
      if (rule.type === 'segment') {
        return context.segment_id && cfg.segment_ids && cfg.segment_ids.includes(context.segment_id);
      }
      if (rule.type === 'low_stock') {
        return true; // checked per item
      }
      if (rule.type === 'event') {
        const start = cfg.start_date ? new Date(cfg.start_date) : null;
        const end = cfg.end_date ? new Date(cfg.end_date) : null;
        return (!start || now >= start) && (!end || now <= end);
      }
      return true;
    } catch (e) { return false; }
  });
}

function applyRulesToPrice(basePrice, rules, context = {}) {
  let price = basePrice;
  for (const rule of rules) {
    try {
      const cfg = JSON.parse(rule.config || '{}');
      if (rule.type === 'low_stock') {
        const stock = context.stock || 0;
        if (stock <= (cfg.threshold || 0)) {
          const multiplier = cfg.increase ? (1 + (cfg.percent || 0) / 100) : (1 - (cfg.percent || 0) / 100);
          price = price * multiplier;
        }
      } else {
        if (cfg.percent) {
          price = price * (1 + cfg.percent / 100);
        } else if (cfg.fixed_amount) {
          price = price + cfg.fixed_amount;
        } else if (cfg.fixed_price) {
          price = cfg.fixed_price;
        }
      }
    } catch (e) {}
  }
  return Math.max(0, Math.round(price * 100) / 100);
}

function getPriceForDish(db, tenantId, dishId, basePrice, context = {}) {
  const rules = getActiveRules(db, tenantId, context);
  const dishRules = rules.filter(r => {
    try {
      const cfg = JSON.parse(r.config || '{}');
      return !cfg.dish_ids || cfg.dish_ids.length === 0 || cfg.dish_ids.includes(dishId);
    } catch (e) { return true; }
  });
  return applyRulesToPrice(basePrice, dishRules, context);
}

function recalculateOrder(db, tenantId, orderItems, context = {}) {
  return orderItems.map(item => {
    const dishId = item.dishId || item.dish_id || item.id;
    const basePrice = Number(item.base_price || item.price || 0);
    const newPrice = getPriceForDish(db, tenantId, dishId, basePrice, { ...context, stock: item.stock });
    return { ...item, price: newPrice, total: newPrice * (item.quantity || 1) };
  });
}

function createRule(db, tenantId, data) {
  const info = db.prepare('INSERT INTO dynamic_pricing_rules (tenant_id, name, type, config, priority, is_active) VALUES (?, ?, ?, ?, ?, ?)')
    .run(tenantId, data.name, data.type, JSON.stringify(data.config || {}), data.priority || 0, data.is_active ? 1 : 0);
  return { id: info.lastInsertRowid };
}

function updateRule(db, tenantId, id, data) {
  db.prepare('UPDATE dynamic_pricing_rules SET name = ?, type = ?, config = ?, priority = ?, is_active = ? WHERE id = ? AND tenant_id = ?')
    .run(data.name, data.type, JSON.stringify(data.config || {}), data.priority || 0, data.is_active ? 1 : 0, id, tenantId);
  return { ok: true };
}

function deleteRule(db, tenantId, id) {
  db.prepare('DELETE FROM dynamic_pricing_rules WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return { ok: true };
}

function getRules(db, tenantId) {
  return db.prepare('SELECT * FROM dynamic_pricing_rules WHERE tenant_id = ? ORDER BY priority DESC, created_at DESC').all(tenantId);
}

module.exports = { getActiveRules, applyRulesToPrice, getPriceForDish, recalculateOrder, createRule, updateRule, deleteRule, getRules };
