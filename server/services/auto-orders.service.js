const cron = require('node-cron');

let lastCheckTimestamp = null;
let cronJob = null;

function getLastCheck() {
  return lastCheckTimestamp;
}

// ─── Settings ──────────────────────────────────────────────────

function getAutoOrderSettings(db, tenantId) {
  const row = db.prepare('SELECT * FROM auto_order_settings WHERE tenant_id = ?').get(tenantId || 1);
  if (!row) {
    return { enabled: 0, check_interval: 6, target_formula: '2x_min', target_fixed_value: 0, target_percent: 200, auto_approve: 0, notify_admin: 1, notify_email: '' };
  }
  return row;
}

function saveAutoOrderSettings(db, tenantId, data) {
  const existing = db.prepare('SELECT id FROM auto_order_settings WHERE tenant_id = ?').get(tenantId || 1);
  const { enabled, check_interval, target_formula, target_fixed_value, target_percent, auto_approve, notify_admin, notify_email } = data;
  if (existing) {
    db.prepare(`UPDATE auto_order_settings SET enabled=?, check_interval=?, target_formula=?, target_fixed_value=?, target_percent=?, auto_approve=?, notify_admin=?, notify_email=? WHERE tenant_id=?`)
      .run(enabled ? 1 : 0, Number(check_interval) || 6, target_formula || '2x_min', Number(target_fixed_value) || 0, Number(target_percent) || 200, auto_approve ? 1 : 0, notify_admin ? 1 : 0, notify_email || '', tenantId || 1);
  } else {
    db.prepare(`INSERT INTO auto_order_settings (tenant_id, enabled, check_interval, target_formula, target_fixed_value, target_percent, auto_approve, notify_admin, notify_email) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(tenantId || 1, enabled ? 1 : 0, Number(check_interval) || 6, target_formula || '2x_min', Number(target_fixed_value) || 0, Number(target_percent) || 200, auto_approve ? 1 : 0, notify_admin ? 1 : 0, notify_email || '');
  }
  return getAutoOrderSettings(db, tenantId);
}

// ─── Target calculation ─────────────────────────────────────────

function calcTargetQty(item, settings) {
  const current = item.current_stock ?? item.current_balance ?? 0;
  const min = item.min_stock || 0;
  const targetOverride = item.target_stock || 0;

  // Per-item target_stock overrides global formula
  if (targetOverride > 0) {
    return Math.max(0, Math.ceil(targetOverride - current));
  }

  const formula = settings.target_formula || '2x_min';
  let target = 0;

  if (formula === 'fixed') {
    target = settings.target_fixed_value || 0;
  } else if (formula === 'percent') {
    target = Math.ceil(min * (settings.target_percent || 200) / 100);
  } else {
    // Default: 2x_min — order up to 2× minimum stock
    target = Math.ceil(min * 2);
  }

  return Math.max(0, Math.ceil(target - current));
}

// ─── Main check ─────────────────────────────────────────────────

function checkAndCreateOrders(db, tenantId = 1) {
  const settings = getAutoOrderSettings(db, tenantId);
  if (!settings.enabled) return { created: 0, message: 'Автозаказы отключены в настройках' };

  const lowStockItems = db.prepare(`
    SELECT ii.*, s.name as supplier_name, s.email as supplier_email
    FROM inventory_items ii
    LEFT JOIN suppliers s ON s.id = ii.default_contragent_id
    WHERE ii.min_stock > 0
      AND ii.auto_order_enabled = 1
      AND (ii.current_stock < ii.min_stock)
      AND ii.default_contragent_id IS NOT NULL
  `).all();

  if (lowStockItems.length === 0) return { created: 0, message: 'Нет товаров ниже минимального остатка' };

  const bySupplier = {};
  for (const item of lowStockItems) {
    const sid = item.default_contragent_id;
    const qty = calcTargetQty(item, settings);
    if (qty <= 0) continue;

    if (!bySupplier[sid]) {
      bySupplier[sid] = { supplier_id: sid, supplier_name: item.supplier_name || 'Поставщик', supplier_email: item.supplier_email || '', items: [] };
    }
    bySupplier[sid].items.push({
      inventory_item_id: item.id,
      name: item.name,
      unit: item.unit || 'шт',
      current_stock: item.current_stock ?? item.current_balance ?? 0,
      min_stock: item.min_stock,
      target_qty: qty,
      price_per_unit: item.price_per_unit || item.last_price || 0,
    });
  }

  let created = 0;
  for (const [sid, group] of Object.entries(bySupplier)) {
    // Skip if a draft auto-order exists for this supplier today
    const existingDraft = db.prepare(`
      SELECT id FROM documents
      WHERE type = 'contactor_order' AND status = 'draft'
        AND counterparty = ?
        AND date = date('now')
        AND note LIKE '%Автоматический%'
    `).get(group.supplier_name);

    if (existingDraft) continue;

    const totalSum = group.items.reduce((s, i) => s + (i.target_qty * i.price_per_unit), 0);
    const docNumber = `AUTO-${Date.now().toString(36).toUpperCase()}`;
    const note = 'Автоматический заказ (низкий остаток)';

    const info = db.prepare(`
      INSERT INTO documents (type, number, date, counterparty, sum, status, items, note, created_at, updated_at)
      VALUES (?, ?, date('now'), ?, ?, 'draft', ?, ?, datetime('now'), datetime('now'))
    `).run(
      'contactor_order', docNumber, group.supplier_name, Math.round(totalSum * 100) / 100,
      JSON.stringify(group.items.map(i => ({
        name: i.name, quantity: i.target_qty, unit: i.unit,
        price: i.price_per_unit,
        total: Math.round(i.target_qty * i.price_per_unit * 100) / 100,
        inventory_item_id: i.inventory_item_id,
      }))), note
    );
    const docId = info.lastInsertRowid;
    created++;

    // Auto-approve if enabled
    if (settings.auto_approve) {
      try {
        db.prepare("UPDATE documents SET status = 'confirmed', approved_at = datetime('now') WHERE id = ?").run(docId);
      } catch {}
    }

    // Send notification
    if (settings.notify_admin) {
      try {
        const admin = db.prepare("SELECT id FROM staff WHERE role IN ('admin','owner','manager') AND tenant_id = ? LIMIT 1").get(tenantId);
        if (admin) {
          db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(
            admin.id, 'Создан автоматический заказ',
            `Поставщику "${group.supplier_name}" на сумму ${Math.round(totalSum)}₽. Товаров: ${group.items.length}.`
          );
        }
      } catch {}
    }
  }

  return { created, total_items: lowStockItems.length };
}

// ─── Order management ──────────────────────────────────────────

function approveOrder(db, docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND type = ?').get(docId, 'contactor_order');
  if (!doc) return { success: false, error: 'Заказ не найден' };
  if (doc.status !== 'draft') return { success: false, error: `Статус "${doc.status}" не позволяет утверждение` };

  db.prepare("UPDATE documents SET status = 'confirmed', approved_at = datetime('now') WHERE id = ?").run(docId);
  return { success: true, status: 'confirmed' };
}

function rejectOrder(db, docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND type = ?').get(docId, 'contactor_order');
  if (!doc) return { success: false, error: 'Заказ не найден' };
  if (doc.status !== 'draft') return { success: false, error: `Статус "${doc.status}" не позволяет отклонение` };

  db.prepare("UPDATE documents SET status = 'cancelled' WHERE id = ?").run(docId);
  return { success: true, status: 'cancelled' };
}

function sendOrder(db, docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND type = ?').get(docId, 'contactor_order');
  if (!doc) return { success: false, error: 'Заказ не найден' };
  if (doc.status !== 'confirmed') return { success: false, error: `Статус "${doc.status}" не позволяет отправку` };

  db.prepare("UPDATE documents SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(docId);
  return { success: true, status: 'completed' };
}

function receiveOrder(db, docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND type = ?').get(docId, 'contactor_order');
  if (!doc) return { success: false, error: 'Заказ не найден' };
  if (doc.status !== 'completed' && doc.status !== 'confirmed') return { success: false, error: `Статус "${doc.status}" не позволяет приёмку` };

  // Parse items and update stock
  let items = [];
  try { items = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []); } catch {}

  for (const item of items) {
    const itemId = item.inventory_item_id || item.itemId || item.id;
    if (!itemId) continue;
    const qty = parseFloat(item.quantity) || 0;
    if (qty <= 0) continue;

    db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) + ?, current_balance = COALESCE(current_balance,0) + ?, last_price = ? WHERE id = ?')
      .run(qty, qty, item.price || 0, itemId);
    db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
      VALUES (?, 'incoming', ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(itemId, qty, item.price || 0, (item.price || 0) * qty, doc.counterparty || '', 'Приёмка по автозаказу', doc.number || '');
  }

  db.prepare("UPDATE documents SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(docId);

  return { success: true, status: 'completed', items_updated: items.length };
}

// ─── Cron scheduling ──────────────────────────────────────────

function scheduleAutoCheck(db) {
  if (cronJob) { cronJob.stop(); }

  cronJob = cron.schedule('0 */6 * * *', () => {
    try {
      const settings = getAutoOrderSettings(db, 1);
      if (!settings.enabled) return;

      const result = checkAndCreateOrders(db, 1);
      lastCheckTimestamp = new Date().toISOString();
      console.log(`[AutoOrders] Check completed: ${result.created} orders created. ${result.message || ''}`);
    } catch (e) {
      console.error('[AutoOrders] Error:', e.message);
    }
  });

  return cronJob;
}

function rescheduleCron(db) {
  if (cronJob) { cronJob.stop(); }
  scheduleAutoCheck(db);
}

module.exports = {
  getAutoOrderSettings, saveAutoOrderSettings,
  checkAndCreateOrders, getLastCheck,
  scheduleAutoCheck, rescheduleCron,
  approveOrder, rejectOrder, sendOrder, receiveOrder,
};
